"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { formatBeneficiaryName } from "@/lib/beneficiaryDisplay";
import { ViewTransactionModal } from "@/components/transactions/ViewTransactionModal";
import { Loader } from "@/components/ui/Loader";
import { AppDialog } from "@/components/ui/AppDialog";
import type { AppDialogProps } from "@/components/ui/AppDialog";
import type { RemittanceTransferRow } from "@/lib/transfer-receipt-from-transfer";
import { Eye, ArrowLeftRight, Send } from "lucide-react";

type DialogFields = Pick<
  AppDialogProps,
  | "variant"
  | "title"
  | "message"
  | "destructive"
  | "confirmLabel"
  | "cancelLabel"
  | "onConfirm"
>;

function apiErrorMessage(error: unknown, fallback: string): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback
  );
}

type Lookups = {
  sourceOfIncome: { value: string; label: string }[];
  transferPurpose: { value: string; label: string }[];
  relationship: { value: string; label: string }[];
};

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
  if (s === "COMPLETED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (s === "FAILED" || s === "CANCELLED")
    return "bg-red-50 text-red-800 border-red-200";
  if (s === "PENDING_PAYMENT") return "bg-amber-50 text-amber-900 border-amber-200";
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

function fmtListDate(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function TransactionsPage() {
  const [rows, setRows] = useState<RemittanceTransferRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [lookups, setLookups] = useState<Lookups | null>(null);

  const [refInput, setRefInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  /** Last applied filters (for empty-state copy and list refresh after proof upload). */
  const [appliedRef, setAppliedRef] = useState("");
  const [appliedDate, setAppliedDate] = useState("");

  const [viewId, setViewId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogFields | null>(null);

  const buildQueryParams = useCallback(
    (ref: string, date: string) => {
      const p: Record<string, string> = { limit: "200" };
      if (ref.trim()) p.reference = ref.trim();
      if (date.trim()) p.date = date.trim();
      return p;
    },
    [],
  );

  const loadTransfers = useCallback(
    async (params: Record<string, string>, opts?: { quiet?: boolean }) => {
      const quiet = opts?.quiet ?? false;
      try {
        if (quiet) setListRefreshing(true);
        else setIsLoading(true);
        const res = await api.get<{
          data: { transfers: RemittanceTransferRow[] };
        }>("/remittance/transfers", { params });
        setRows(res.data.data.transfers);
      } catch (e) {
        console.error(e);
        setDialog({
          variant: "error",
          title: "Could not load transactions",
          message:
            apiErrorMessage(e, "Check your connection and try again.") +
            " You can refresh the page to retry.",
        });
      } finally {
        if (quiet) setListRefreshing(false);
        else setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadTransfers({ limit: "200" });
  }, [loadTransfers]);

  useEffect(() => {
    let c = false;
    void api
      .get<{
        data: {
          sourceOfIncome: Lookups["sourceOfIncome"];
          transferPurpose: Lookups["transferPurpose"];
          relationship: Lookups["relationship"];
        };
      }>("/remittance/lookups")
      .then((res) => {
        if (c) return;
        setLookups({
          sourceOfIncome: res.data.data.sourceOfIncome,
          transferPurpose: res.data.data.transferPurpose,
          relationship: res.data.data.relationship,
        });
      })
      .catch(() => {
        if (!c) setLookups(null);
      });
    return () => {
      c = true;
    };
  }, []);

  const applyFilters = () => {
    const r = refInput.trim();
    const d = dateInput.trim();
    setAppliedRef(r);
    setAppliedDate(d);
    void loadTransfers(buildQueryParams(r, d), { quiet: true });
  };

  const clearFilters = () => {
    setRefInput("");
    setDateInput("");
    setAppliedRef("");
    setAppliedDate("");
    void loadTransfers({ limit: "200" }, { quiet: true });
  };

  const refreshListWithAppliedFilters = useCallback(() => {
    void loadTransfers(buildQueryParams(appliedRef, appliedDate), {
      quiet: true,
    });
  }, [loadTransfers, buildQueryParams, appliedRef, appliedDate]);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  if (isLoading) {
    return (
      <Loader
        variant="page"
        size="xl"
        label="Loading transactions…"
        sublabel="Fetching your transfer history."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10 relative">
      {listRefreshing && (
        <div className="absolute top-0 right-0 z-10">
          <Loader variant="inline" size="sm" label="Updating…" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Transactions
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            Transfers you have submitted, with references, pay-in details, and
            payment proof files. Download a PDF receipt for any transfer.
          </p>
        </div>
        <Link
          href="/send-money"
          className="inline-flex items-center justify-center gap-2 h-11 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl shadow-sm shadow-teal-600/20 transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
          New transfer
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
            <input
              id="tx-ref"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="Reference"
              className="min-w-[8rem] flex-1 h-9 px-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="h-9 min-w-[10rem] flex-1 max-w-[11rem] rounded-lg border border-slate-200 px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={applyFilters}
              className="h-9 px-3 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 px-3 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-8 py-16 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
            <ArrowLeftRight className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No transactions match
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-6 max-w-sm mx-auto">
            {appliedRef || appliedDate
              ? "Try adjusting your filters, or start a new transfer from Send money."
              : "When you complete a transfer in Send money, it will show up here."}
          </p>
          <Link
            href="/send-money"
            className="inline-flex items-center gap-2 h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
            Send money
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((t) => {
            const name = t.beneficiary
              ? formatBeneficiaryName(t.beneficiary)
              : "—";
            const subtitle =
              t.recipientCountryLabel?.trim() ||
              t.beneficiary?.country?.trim() ||
              "—";
            const amountLine =
              t.payCurrency && t.payAmount != null
                ? `${fmtMoney(Number(t.payAmount))} ${t.payCurrency}`
                : "—";
            const nProofs = t.paymentProofs?.length ?? 0;

            return (
              <li key={t.id}>
                <div className="group rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                  <div className="flex gap-4">
                    <div
                      className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center text-sm font-semibold shadow-inner"
                      aria-hidden
                    >
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-semibold text-slate-900 font-mono tracking-tight truncate">
                            {t.referenceCode}
                          </h3>
                          <p className="text-sm text-slate-600 mt-0.5 truncate">
                            {name} · {subtitle}
                          </p>
                          <p className="text-sm font-medium text-slate-800 mt-1.5 tabular-nums">
                            {amountLine}
                          </p>
                          <p className="text-xs text-slate-500 mt-1.5">
                            {fmtListDate(t.createdAt)}
                            {nProofs > 0
                              ? ` · ${nProofs} payment proof file${nProofs === 1 ? "" : "s"}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] uppercase font-semibold tracking-wide px-2 py-1 rounded-md border max-w-[10rem] text-right leading-tight ${statusBadgeClass(t.status)}`}
                        >
                          {statusLabel(t.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setViewId(t.id)}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ViewTransactionModal
        open={viewId !== null}
        transferId={viewId}
        onClose={() => setViewId(null)}
        lookups={lookups}
        onTransferUpdated={refreshListWithAppliedFilters}
      />

      {dialog ? (
        <AppDialog
          open
          onClose={closeDialog}
          variant={dialog.variant}
          title={dialog.title}
          message={dialog.message}
          destructive={dialog.destructive}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          onConfirm={dialog.onConfirm}
        />
      ) : null}
    </div>
  );
}
