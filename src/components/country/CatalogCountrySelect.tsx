"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { FlexCountry } from "@/types/flex-country";
import {
  fetchCatalogCountries,
  matchFlexCountryByLabel,
} from "@/lib/catalog-countries";
import { FlexCountryFlag } from "./FlexCountryFlag";
import {
  fieldDropdownOption,
  fieldDropdownSearch,
  fieldSelectTriggerBase,
} from "@/lib/field-styles";
import { FieldSelectChevron } from "@/components/ui/FieldSelectChevron";

export type CatalogCountrySelectProps = {
  value: string;
  onChange: (couName: string) => void;
  error?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  listClassName?: string;
  /** If provided, internal catalog load is skipped. */
  countries?: FlexCountry[];
  countriesLoading?: boolean;
  countriesError?: string;
};

/**
 * Searchable country picker with flags, backed by the full static catalog (not Flex allowlist).
 * Styling matches {@link FlexCountrySelect}.
 */
export function CatalogCountrySelect({
  value,
  onChange,
  error = false,
  disabled = false,
  placeholder = "Select country…",
  className = "",
  listClassName = "max-h-52",
  countries: countriesProp,
  countriesLoading: loadingProp,
  countriesError: errorProp,
}: CatalogCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [internal, setInternal] = useState<FlexCountry[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState("");

  const useExternal = countriesProp !== undefined;
  const catalogCountries = useExternal ? countriesProp : internal;
  const catalogLoading = useExternal ? Boolean(loadingProp) : internalLoading;
  const catalogError = useExternal ? (errorProp ?? "") : internalError;

  useEffect(() => {
    if (useExternal) return;
    let cancelled = false;
    setInternalLoading(true);
    setInternalError("");
    fetchCatalogCountries()
      .then((list) => {
        if (!cancelled) setInternal(list);
      })
      .catch(() => {
        if (!cancelled) {
          setInternal([]);
          setInternalError("Could not load countries");
        }
      })
      .finally(() => {
        if (!cancelled) setInternalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useExternal]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return catalogCountries;
    return catalogCountries.filter(
      (c) =>
        c.couName.toLowerCase().includes(q) ||
        c.couCode.toLowerCase().includes(q),
    );
  }, [catalogCountries, search]);

  const selected = useMemo(
    () => matchFlexCountryByLabel(catalogCountries, value),
    [catalogCountries, value],
  );

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-catalog-country-select]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={rootRef} data-catalog-country-select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          setSearch("");
        }}
        className={`${fieldSelectTriggerBase} ${
          error ? "border-red-400" : "border-slate-200"
        } ${value ? "text-slate-900" : "text-slate-400"} ${className}`}
      >
        {value && selected ? (
          <>
            <FlexCountryFlag couCode={selected.couCode} />
            <span className="truncate">{value}</span>
          </>
        ) : value ? (
          <span className="truncate">{value}</span>
        ) : (
          <span>{placeholder}</span>
        )}
        <FieldSelectChevron className="ml-auto" />
      </button>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              placeholder="Search country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={fieldDropdownSearch}
            />
          </div>
          <ul className={`${listClassName} overflow-y-auto py-1`}>
            {catalogLoading && (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                Loading countries…
              </li>
            )}
            {!catalogLoading &&
              filtered.map((c, idx) => (
                <li key={`${c.couCode}-${c.couName}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.couName);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`${fieldDropdownOption} gap-2.5 ${
                      selected?.couCode === c.couCode
                        ? "bg-red-50 text-red-700 font-medium"
                        : "text-slate-700"
                    }`}
                  >
                    <FlexCountryFlag couCode={c.couCode} />
                    <span>{c.couName}</span>
                    {selected?.couCode === c.couCode && (
                      <svg
                        className="ml-auto w-4 h-4 text-red-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            {!catalogLoading && filtered.length === 0 && (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                {catalogError || "No countries found"}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
