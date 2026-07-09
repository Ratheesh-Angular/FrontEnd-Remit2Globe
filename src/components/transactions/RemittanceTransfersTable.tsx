"use client";

import { PaymentProofRowAction } from "@/components/transactions/PaymentProofRowAction";
import { formatBeneficiaryName } from "@/lib/beneficiaryDisplay";
import type { RemittanceTransferRow } from "@/lib/transfer-receipt-from-transfer";
import { formatDate } from "date-fns";
import { Eye } from "lucide-react";

function statusLabel(s: string) {
  const map: Record<string, string> = {
    PENDING_PAYMENT: "Pending payment",
    PAYMENT_SUBMITTED: "Payment submitted",
    UNDER_REVIEW: "Under review",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  };
  return map[s] ?? s.replace(/_/g, " ");
}

function statusBadgeClass(s: string) {
  if (s === "COMPLETED")
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (s === "FAILED" || s === "CANCELLED")
    return "bg-red-50 text-red-800 border-red-200";
  if (s === "PENDING_PAYMENT")
    return "bg-amber-50 text-amber-900 border-amber-200";
  if (s === "PROCESSING" || s === "UNDER_REVIEW" || s === "PAYMENT_SUBMITTED")
    return "bg-sky-50 text-sky-800 border-sky-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rowDisplay(t: RemittanceTransferRow) {
  const name = t.beneficiary ? formatBeneficiaryName(t.beneficiary) : "—";
  const deliveryChannel =
    t.beneficiary?.deliveryChannel === "MOBILE_MONEY"
      ? "Mobile Money"
      : "Bank Transfer";
  const recipientGets =
    t.receiveAmount != null && t.receiveCurrency
      ? `${fmtMoney(Number(t.receiveAmount))} ${t.receiveCurrency}`
      : "—";
  const youPay =
    t.payAmount != null && t.payCurrency
      ? `${fmtMoney(Number(t.payAmount))} ${t.payCurrency}`
      : "—";
  return { name, deliveryChannel, recipientGets, youPay };
}

export type RemittanceTransfersTableProps = {
  rows: RemittanceTransferRow[];
  onViewTransfer: (transferId: string) => void;
  /** After payment proof upload from a row, refresh the list. */
  onTransferUpdated?: () => void;
  /** Extra class on the outer bordered wrapper */
  className?: string;
};

/**
 * Shared transactions table: desktop table + mobile stacked cards.
 * Matches the Transactions page layout and styling.
 */
export function RemittanceTransfersTable({
  rows,
  onViewTransfer,
  onTransferUpdated,
  className = "",
}: RemittanceTransfersTableProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`.trim()}
    >
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-700 uppercase tracking-wider px-4 py-3">
                Date
              </th>
              <th className="text-left text-xs font-semibold text-slate-700 uppercase tracking-wider px-4 py-3">
                Beneficiary Name
              </th>
              <th className="text-left text-xs font-semibold text-slate-700 uppercase tracking-wider px-4 py-3">
                Delivery
              </th>
              <th className="text-right text-xs font-semibold text-slate-700 uppercase tracking-wider px-4 py-3">
                You Pay
              </th>
              <th className="text-right text-xs font-semibold text-slate-700 uppercase tracking-wider px-4 py-3">
                Recipient Gets
              </th>
              <th className="text-left text-xs font-semibold text-slate-700 uppercase tracking-wider px-4 py-3">
                Status
              </th>
              <th className="text-center text-xs font-semibold text-slate-700 uppercase tracking-wider px-4 py-3 w-28">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((t) => {
              const { name, deliveryChannel, recipientGets, youPay } =
                rowDisplay(t);
              return (
                <tr
                  key={t.id}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-700">
                      {formatDate(new Date(t.createdAt ?? ""), "MMM d, yyyy")}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
                        {name}
                      </span>
                      <span className="text-xs text-slate-500 font-mono mt-0.5">
                        {t.referenceCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-700">
                      {deliveryChannel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900 tabular-nums">
                      {youPay}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-medium text-slate-900 tabular-nums">
                      {recipientGets}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center text-[10px] uppercase font-semibold tracking-wide px-2.5 py-1 rounded-md border ${statusBadgeClass(t.status)}`}
                    >
                      {statusLabel(t.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onViewTransfer(t.id)}
                        className="cursor-pointer inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="View transaction"
                        aria-label="View transaction"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <PaymentProofRowAction
                        transfer={t}
                        onUploaded={onTransferUpdated}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-slate-100">
        {rows.map((t) => {
          const { name, deliveryChannel, recipientGets, youPay } =
            rowDisplay(t);
          return (
            <div key={t.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {t.referenceCode}
                  </p>
                </div>
                <div className="shrink-0 inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onViewTransfer(t.id)}
                    className="cursor-pointer inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="View transaction"
                    aria-label="View transaction"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <PaymentProofRowAction
                    transfer={t}
                    onUploaded={onTransferUpdated}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block mb-1">
                    Delivery
                  </span>
                  <span className="text-slate-900 font-medium">
                    {deliveryChannel}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block mb-1">
                    You pay
                  </span>
                  <span className="text-slate-900 font-medium tabular-nums">
                    {youPay}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-500 block mb-1">
                  Recipient gets
                </span>
                <span className="text-sm font-medium text-slate-900 tabular-nums">
                  {recipientGets}
                </span>
              </div>

              <div>
                <span
                  className={`inline-flex items-center text-[10px] uppercase font-semibold tracking-wide px-2.5 py-1 rounded-md border ${statusBadgeClass(t.status)}`}
                >
                  {statusLabel(t.status)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
