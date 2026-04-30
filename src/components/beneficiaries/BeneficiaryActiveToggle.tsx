"use client";

import { useState } from "react";
import { sessionApi as api } from "@/lib/api";

type BeneficiaryActiveToggleProps = {
  beneficiaryId: string;
  active: boolean;
  onChange: (next: boolean) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

export function BeneficiaryActiveToggle({
  beneficiaryId,
  active,
  onChange,
  onError,
  disabled = false,
}: BeneficiaryActiveToggleProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy || disabled) return;
    const next = !active;
    setBusy(true);
    try {
      await api.patch(`/beneficiaries/${beneficiaryId}`, { active: next });
      onChange(next);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not update status.";
      onError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={
        active ? "Active: click to deactivate" : "Inactive: click to activate"
      }
      disabled={busy || disabled}
      onClick={handleClick}
      className="relative inline-grid h-9 w-[8.75rem] grid-cols-2 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 p-0.5 shadow-inner transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full shadow-sm transition-transform duration-200 ease-out ${
          active ? "bg-emerald-600" : "bg-red-600"
        }`}
        style={{
          transform: active ? "translateX(calc(100% + 4px))" : "translateX(0)",
        }}
      />
      <span
        className={`relative z-[1] flex items-center justify-center text-[11px] font-semibold tracking-wide transition-colors ${
          !active ? "text-white" : "text-slate-500"
        }`}
      >
        Inactive
      </span>
      <span
        className={`relative z-[1] flex items-center justify-center text-[11px] font-semibold tracking-wide transition-colors ${
          active ? "text-white" : "text-slate-500"
        }`}
      >
        Active
      </span>
    </button>
  );
}
