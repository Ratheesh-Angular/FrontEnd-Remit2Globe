"use client";

import { useEffect, useRef, useState } from "react";
import Flag from "react-world-flags";
import { ChevronDown } from "lucide-react";
import { LANDING_COUNTRIES } from "@/lib/landing-countries";
import { useLandingCountry } from "./LandingCountryContext";

type LandingCountrySelectProps = {
  className?: string;
  fullWidth?: boolean;
  onSelect?: () => void;
};

export function LandingCountrySelect({
  className = "",
  fullWidth = false,
  onSelect,
}: LandingCountrySelectProps) {
  const { selectedCountry, setSelectedCountryId } = useLandingCountry();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 h-10 px-3 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:border-red-300 hover:bg-red-50/50 transition-colors ${
          fullWidth ? "w-full justify-between" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Flag
          code={selectedCountry.iso2}
          className="w-5 h-3.5 rounded-sm object-cover shrink-0"
        />
        <span className="max-w-[7rem] truncate">{selectedCountry.name}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[12rem] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/60"
        >
          {LANDING_COUNTRIES.map((country) => (
            <li key={country.id}>
              <button
                type="button"
                role="option"
                aria-selected={country.id === selectedCountry.id}
                onClick={() => {
                  setSelectedCountryId(country.id);
                  setOpen(false);
                  onSelect?.();
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 ${
                  country.id === selectedCountry.id
                    ? "bg-red-50 text-red-700 font-medium"
                    : "text-slate-700"
                }`}
              >
                <Flag
                  code={country.iso2}
                  className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                />
                {country.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
