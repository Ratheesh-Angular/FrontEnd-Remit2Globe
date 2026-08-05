"use client";

import type { ReactNode } from "react";
import { formatBeneficiaryName } from "@/lib/beneficiaryDisplay";
import { fmtFxRate, fmtMoney } from "@/lib/send-money-currencies";
import { Loader } from "@/components/ui/Loader";

type BeneficiaryLike = {
  firstName: string;
  lastName: string;
};

export type TransactionSummaryPanelProps = {
  recipientCountryDisplay: string | null;
  beneficiary: BeneficiaryLike | null;
  youSend: number | null;
  youSendCurrency: string;
  rate: number | null;
  rateFromCurrency: string;
  rateToCurrency: string;
  fee: number | null;
  feeCurrency: string;
  receive: number | null;
  receiveCurrency: string;
  loading?: boolean;
};

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/10 last:border-b-0">
      <dt className="text-sm text-slate-400 shrink-0">{label}</dt>
      <dd
        className={`text-sm text-right tabular-nums ${valueClassName ?? "text-white font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatCurrencyAmount(
  amount: number | null,
  currency: string,
  loading?: boolean,
): ReactNode {
  if (loading) {
    return <Loader variant="inline" size="sm" className="text-red-400" />;
  }
  if (amount == null || !Number.isFinite(amount)) {
    return "—";
  }
  return (
    <>
      {currency} {fmtMoney(amount)}
    </>
  );
}

export function TransactionSummaryPanel({
  recipientCountryDisplay,
  beneficiary,
  youSend,
  youSendCurrency,
  rate,
  rateFromCurrency,
  rateToCurrency,
  fee,
  feeCurrency,
  receive,
  receiveCurrency,
  loading = false,
}: TransactionSummaryPanelProps) {
  const rateDisplay =
    loading && (youSend != null || receive != null) ? (
      <Loader variant="inline" size="sm" className="text-red-400" />
    ) : rate != null &&
        rateFromCurrency.trim() &&
        rateToCurrency.trim() ? (
      <>
        1 {rateFromCurrency} = {fmtFxRate(rate)} {rateToCurrency}
      </>
    ) : (
      "—"
    );

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-base font-semibold text-white">
            Transaction summary
          </h2>
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-red-500"
            aria-hidden
          />
        </div>

        <dl className="mt-2">
          <SummaryRow
            label="Recipient country"
            value={recipientCountryDisplay ?? "—"}
          />
          <SummaryRow
            label="Sending to"
            value={
              beneficiary ? (
                formatBeneficiaryName(beneficiary)
              ) : (
                <span className="italic text-slate-500 font-normal">
                  Select in step 2
                </span>
              )
            }
            valueClassName={
              beneficiary ? "text-white font-medium" : "text-slate-500"
            }
          />
          <SummaryRow
            label="You send"
            value={formatCurrencyAmount(youSend, youSendCurrency, loading)}
          />
          <SummaryRow label="Rate" value={rateDisplay} />
          <SummaryRow
            label="Fees"
            value={formatCurrencyAmount(fee, feeCurrency, loading)}
          />
        </dl>

        <div className="mt-4 rounded-xl border border-white/5 bg-black/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500">
            They receive
          </p>
          {loading && (youSend != null || receive != null) ? (
            <div className="mt-2">
              <Loader variant="inline" size="sm" className="text-red-400" />
            </div>
          ) : receive != null && Number.isFinite(receive) ? (
            <p className="mt-1 text-3xl font-bold tabular-nums text-white tracking-tight">
              {receiveCurrency} {fmtMoney(receive)}
            </p>
          ) : (
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-500">
              —
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center px-2">
        Saved and rate-locked while you verify.
      </p>
    </div>
  );
}
