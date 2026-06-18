"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  fieldDropdownOption,
  fieldDropdownSearch,
  fieldSelectTriggerBase,
} from "@/lib/field-styles";
import { FieldSelectChevron } from "@/components/ui/FieldSelectChevron";

type StateSearchSelectProps = {
  /** Display name of the country of residence (must match Flex / Countries Now). */
  countryName: string;
  value: string;
  onChange: (state: string) => void;
  error?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function StateSearchSelect({
  countryName,
  value,
  onChange,
  error = false,
  disabled = false,
  placeholder = "Search and select state or region…",
  className = "",
}: StateSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stateNames, setStateNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-state-search-select]")) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    setStateNames([]);
    setLoadError("");
    const name = countryName.trim();
    if (!name) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ country: name });
    fetch(`/api/geo/states?${q.toString()}`)
      .then((r) => r.json() as Promise<{ stateNames?: string[]; error?: string }>)
      .then((data) => {
        if (cancelled) return;
        setStateNames(Array.isArray(data.stateNames) ? data.stateNames : []);
        if (data.error) setLoadError(data.error);
      })
      .catch(() => {
        if (cancelled) return;
        setStateNames([]);
        setLoadError("Could not load states");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryName]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return stateNames;
    return stateNames.filter((s) => s.toLowerCase().includes(q));
  }, [stateNames, search]);

  const canUseCustom =
    open &&
    search.trim().length > 0 &&
    !filtered.some(
      (s) => s.toLowerCase() === search.trim().toLowerCase(),
    );

  return (
    <div className="relative" ref={rootRef} data-state-search-select>
      <button
        type="button"
        disabled={disabled || !countryName.trim()}
        onClick={() => {
          if (disabled || !countryName.trim()) return;
          setOpen((v) => {
            const next = !v;
            if (next) setSearch(value || "");
            return next;
          });
        }}
        className={`${fieldSelectTriggerBase} ${
          error ? "border-red-400" : "border-slate-200"
        } ${value ? "text-slate-900" : "text-slate-400"} ${className}`}
      >
        <span className="truncate flex-1">
          {!countryName.trim()
            ? "Set country in Personal Info first"
            : value || placeholder}
        </span>
        <FieldSelectChevron className="ml-auto" />
      </button>
      {open && countryName.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              placeholder="Search state or region…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  e.preventDefault();
                  onChange(search.trim());
                  setOpen(false);
                  setSearch("");
                }
                if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              className={fieldDropdownSearch}
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {loading && (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                Loading states…
              </li>
            )}
            {!loading && loadError && (
              <li className="px-3 py-2 text-xs text-amber-700">
                {loadError} — you can type a state below and press Enter.
              </li>
            )}
            {!loading &&
              filtered.map((s, idx) => (
                <li key={`${s}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(s);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`${fieldDropdownOption} ${
                      value === s
                        ? "bg-teal-50 text-teal-700 font-medium"
                        : "text-slate-700"
                    }`}
                  >
                    {s}
                    {value === s && (
                      <svg
                        className="ml-auto w-4 h-4 text-teal-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden
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
            {canUseCustom && (
              <li className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onChange(search.trim());
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full px-3 py-2.5 text-sm text-left text-teal-700 font-medium hover:bg-teal-50"
                >
                  Use “{search.trim()}”
                </button>
              </li>
            )}
            {!loading && !stateNames.length && !loadError && (
              <li className="px-3 py-3 text-sm text-slate-500">
                No official list for this country — type your state/region
                and press <kbd className="px-1 rounded bg-slate-100">Enter</kbd>.
              </li>
            )}
            {!loading && stateNames.length > 0 && filtered.length === 0 && !canUseCustom && (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                No matches — adjust your search or use Enter to apply what you
                typed.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
