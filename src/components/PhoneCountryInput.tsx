"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Flag from "react-world-flags";
import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";
import { ALL_COUNTRIES, type Country } from "@/lib/phone-countries";

/** E.164 validation using full lib metadata — the default `min` build can reject valid numbers. */
export function isValidE164Phone(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  try {
    return isValidPhoneNumber(raw);
  } catch {
    return false;
  }
}

export type PhoneCountryInputProps = {
  id?: string;
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  error?: string;
  /** When `value` is empty, pre-select this dial country (e.g. profile ISO2). */
  defaultIso2?: string | null;
  hint?: ReactNode;
};

function composeE164(c: Country | null, nationalDigits: string): string {
  if (!c) return "";
  const digits = nationalDigits.replace(/\D/g, "").slice(0, c.maxDigits);
  if (!digits.length) return "";
  return `+${c.dialCode}${digits}`;
}

export function PhoneCountryInput({
  id,
  value,
  onChange,
  disabled,
  error,
  defaultIso2,
  hint,
}: PhoneCountryInputProps) {
  const [selected, setSelected] = useState<Country | null>(null);
  const [local, setLocal] = useState("");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const composed = useMemo(
    () => composeE164(selected, local),
    [selected, local],
  );

  /** Flush composed E.164 to parent in layout so `value` is updated before effects that reset local state on `value === ""`. */
  useLayoutEffect(() => {
    const prev = value.trim();
    const next = composed.trim();
    if (next === prev) return;
    onChange(next);
  }, [composed, value, onChange]);

  useEffect(() => {
    const v = value.trim();
    if (!v) {
      // Parent `value` may lag behind `composed` after typing/layout sync — don't wipe digits.
      if (composed.trim()) return;
      setLocal("");
      setSelected((prev) => {
        if (prev) return prev;
        if (defaultIso2) {
          return (
            ALL_COUNTRIES.find((x) => x.code === defaultIso2.toUpperCase()) ??
            null
          );
        }
        return null;
      });
      return;
    }
    if (v === composed) return;
    try {
      const pn = parsePhoneNumberFromString(v);
      const iso = pn?.country;
      if (iso) {
        const c = ALL_COUNTRIES.find((x) => x.code === iso);
        if (c) {
          setSelected(c);
          setLocal(
            pn?.nationalNumber != null ? String(pn.nationalNumber) : "",
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, [value, defaultIso2, composed]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const digitsOnly = s.replace(/\D/g, "");
    if (!s) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (digitsOnly.length > 0 && c.dialCode.startsWith(digitsOnly)) ||
        c.code.toLowerCase().includes(s),
    );
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest("[data-phone-country-dropdown]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const updateNational = useCallback(
    (c: Country, digits: string) => {
      const d = digits.replace(/\D/g, "").slice(0, c.maxDigits);
      setLocal(d);
      onChange(composeE164(c, d));
    },
    [onChange],
  );

  const wrapError = error
    ? "border-red-400 focus-within:ring-red-400/20 focus-within:border-red-400"
    : "border-slate-200 focus-within:ring-teal-500/20 focus-within:border-teal-600";

  return (
    <div>
      <div
        className={`flex items-center border rounded-lg overflow-visible transition-all focus-within:ring-2 bg-white ${wrapError} ${
          disabled ? "bg-slate-50 opacity-70" : ""
        }`}
      >
        <div className="flex-shrink-0 relative" data-phone-country-dropdown>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setOpen((o) => !o);
              setQ("");
            }}
            className="flex items-center gap-1.5 px-3 h-11 text-sm bg-slate-100 border-r border-slate-200 rounded-l-lg text-left min-w-[8.5rem] max-w-[11rem] hover:bg-slate-50 disabled:cursor-not-allowed"
          >
            {selected ? (
              <>
                <Flag
                  code={selected.code}
                  style={{
                    width: 20,
                    height: 14,
                    borderRadius: 2,
                    objectFit: "cover",
                  }}
                />
                <span className="text-slate-700 font-medium truncate">
                  +{selected.dialCode}
                </span>
              </>
            ) : (
              <span className="text-slate-400 truncate">Country code</span>
            )}
            <svg
              className="w-4 h-4 text-slate-400 shrink-0 ml-auto"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {open && (
            <div className="absolute z-[60] left-0 mt-1 w-[min(100vw-2rem,18rem)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <input
                  autoFocus
                  placeholder="Search country or code…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto py-1">
                {filtered.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-teal-50 hover:text-teal-700 ${
                        selected?.code === c.code
                          ? "bg-teal-50 text-teal-800 font-medium"
                          : "text-slate-700"
                      }`}
                      onClick={() => {
                        setSelected(c);
                        setLocal("");
                        setOpen(false);
                        setQ("");
                        onChange("");
                      }}
                    >
                      <Flag
                        code={c.code}
                        style={{
                          width: 20,
                          height: 14,
                          borderRadius: 2,
                          objectFit: "cover",
                        }}
                      />
                      <span className="truncate min-w-0">{c.name}</span>
                      <span className="ml-auto shrink-0 text-slate-500 font-mono text-xs">
                        +{c.dialCode}
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-3 text-sm text-slate-400 text-center">
                    No matches
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled || !selected}
          placeholder={
            selected
              ? selected.minDigits === selected.maxDigits
                ? `${selected.minDigits} digits`
                : `${selected.minDigits}–${selected.maxDigits} digits`
              : "Select country code first"
          }
          value={local}
          onChange={(e) => {
            if (!selected) return;
            updateNational(selected, e.target.value);
          }}
          className="flex-1 h-11 px-3 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 disabled:cursor-not-allowed font-mono tracking-wide"
        />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {hint && !error ? (
        <div className="mt-1.5 text-xs text-slate-600 leading-relaxed">{hint}</div>
      ) : null}
    </div>
  );
}
