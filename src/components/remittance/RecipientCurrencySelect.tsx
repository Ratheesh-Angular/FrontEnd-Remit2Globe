"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Flag from "react-world-flags";
import { ChevronDown } from "lucide-react";
import {
  fieldDropdownOption,
  fieldDropdownSearch,
} from "@/lib/field-styles";
import {
  payCurrencyFlagCode,
  type RecipientReceiveOption,
} from "@/lib/send-money-currencies";
import { cn } from "@/lib/utils";

export type RecipientCurrencySelectProps = {
  value: string;
  onChange: (option: RecipientReceiveOption) => void;
  options: RecipientReceiveOption[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
  listClassName?: string;
};

export function RecipientCurrencySelect({
  value,
  onChange,
  options,
  loading = false,
  disabled = false,
  placeholder = "Select currency…",
  triggerClassName,
  listClassName = "max-h-52",
}: RecipientCurrencySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.currency.toLowerCase().includes(q) ||
        opt.couName.toLowerCase().includes(q),
    );
  }, [options, search]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-recipient-currency-select]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div
      className="relative shrink-0"
      ref={rootRef}
      data-recipient-currency-select
    >
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          if (disabled || loading) return;
          setOpen((o) => !o);
          setSearch("");
        }}
        className={cn(
          "cursor-pointer flex items-center gap-2 h-14 px-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors min-w-[9rem] text-left disabled:opacity-60 disabled:cursor-not-allowed",
          triggerClassName,
        )}
      >
        {value ? (
          <>
            <span className="inline-flex h-8 w-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
              <Flag
                code={payCurrencyFlagCode(value)}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="text-base font-bold text-slate-900">{value}</span>
          </>
        ) : (
          <span className="text-sm text-slate-400">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 ml-auto shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 right-0 mt-2 w-[min(100vw-2rem,18rem)] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              placeholder="Search currency or country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={fieldDropdownSearch}
            />
          </div>
          <ul className={cn(listClassName, "overflow-y-auto py-1")}>
            {loading && (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                Loading currencies…
              </li>
            )}
            {!loading &&
              filtered.map((opt) => (
                <li key={opt.currency}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      fieldDropdownOption,
                      "items-start gap-2.5",
                      value === opt.currency
                        ? "bg-red-50 text-red-800 font-medium"
                        : "text-slate-700",
                    )}
                  >
                    <Flag
                      code={payCurrencyFlagCode(opt.currency)}
                      className="w-6 h-4 rounded object-cover shrink-0 mt-0.5"
                    />
                    <span className="min-w-0 flex-1 flex flex-col gap-0.5 text-left">
                      <span className="font-semibold leading-tight text-sm">
                        {opt.currency}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] leading-snug line-clamp-2",
                          value === opt.currency
                            ? "text-red-700/85"
                            : "text-slate-500",
                        )}
                        title={opt.couName}
                      >
                        {opt.couName}
                      </span>
                    </span>
                    {value === opt.currency && (
                      <svg
                        className="ml-auto w-4 h-4 shrink-0 text-red-600 mt-1"
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
            {!loading && filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-slate-400 text-center">
                No match
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
