"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { FlexCountry } from "@/types/flex-country";
import { flexApiUrl, parseFlexCountriesResponse } from "@/lib/flex-api";
import { FlexCountryFlag } from "./FlexCountryFlag";
import {
  fieldDropdownOption,
  fieldDropdownSearch,
  fieldSelectTriggerBase,
} from "@/lib/field-styles";
import { FieldSelectChevron } from "@/components/ui/FieldSelectChevron";

export type FlexCountrySelectProps = {
  value: string;
  onChange: (couName: string) => void;
  error?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  listClassName?: string;
  /** If provided, internal fetch is skipped. */
  countries?: FlexCountry[];
  countriesLoading?: boolean;
  countriesError?: string;
};

export function FlexCountrySelect({
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
}: FlexCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [internal, setInternal] = useState<FlexCountry[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState("");

  const useExternal = countriesProp !== undefined;
  const flexCountries = useExternal ? countriesProp : internal;
  const flexCountriesLoading = useExternal
    ? Boolean(loadingProp)
    : internalLoading;
  const flexCountriesError = useExternal
    ? (errorProp ?? "")
    : internalError;

  useEffect(() => {
    if (useExternal) return;
    let cancelled = false;
    setInternalLoading(true);
    setInternalError("");
    fetch(flexApiUrl("/countries"), {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setInternal(parseFlexCountriesResponse(json));
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
    if (!q) return flexCountries;
    return flexCountries.filter(
      (c) =>
        c.couName.toLowerCase().includes(q) ||
        c.couCode.toLowerCase().includes(q),
    );
  }, [flexCountries, search]);

  const selected = flexCountries.find((c) => c.couName === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-flex-country-select]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={rootRef} data-flex-country-select>
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
      {open && (
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
            {flexCountriesLoading && (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                Loading countries…
              </li>
            )}
            {!flexCountriesLoading &&
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
                      value === c.couName
                        ? "bg-red-50 text-red-700 font-medium"
                        : "text-slate-700"
                    }`}
                  >
                    <FlexCountryFlag couCode={c.couCode} />
                    <span>{c.couName}</span>
                    {value === c.couName && (
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
            {!flexCountriesLoading && filtered.length === 0 && (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                {flexCountriesError || "No countries found"}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
