"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { sessionApi as api } from "@/lib/api";
import { ViewTransactionModal } from "@/components/transactions/ViewTransactionModal";
import { RemittanceTransfersTable } from "@/components/transactions/RemittanceTransfersTable";
import { Loader } from "@/components/ui/Loader";
import { AppDialog } from "@/components/ui/AppDialog";
import type { AppDialogProps } from "@/components/ui/AppDialog";
import type { RemittanceTransferRow } from "@/lib/transfer-receipt-from-transfer";
import { ArrowLeftRight, Send } from "lucide-react";

const TRANSACTIONS_PAGE_SIZE = 5;

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

type DateRangePreset =
  | "ALL"
  | "TODAY"
  | "YESTERDAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "CUSTOM";

/** Calendar date in local timezone as YYYY-MM-DD (avoids UTC shift from toISOString). */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function validateCustomRange(from: string, to: string): string | null {
  const f = from.trim();
  const t = to.trim();
  if (!f || !t) return "Select both start and end dates.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return "Use the date picker to choose valid dates.";
  }
  if (f > t) return "The start date must be on or before the end date.";
  return null;
}

function computeDateRange(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string,
): { from?: string; to?: string } {
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  switch (preset) {
    case "ALL":
      return {};
    case "TODAY":
      return {
        from: formatLocalYmd(startOfToday),
        to: formatLocalYmd(startOfToday),
      };
    case "YESTERDAY": {
      const yesterday = new Date(startOfToday);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        from: formatLocalYmd(yesterday),
        to: formatLocalYmd(yesterday),
      };
    }
    case "LAST_7_DAYS": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 6);
      return { from: formatLocalYmd(from), to: formatLocalYmd(startOfToday) };
    }
    case "LAST_30_DAYS": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 29);
      return { from: formatLocalYmd(from), to: formatLocalYmd(startOfToday) };
    }
    case "THIS_MONTH": {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        from: formatLocalYmd(firstDay),
        to: formatLocalYmd(startOfToday),
      };
    }
    case "LAST_MONTH": {
      const firstDayLastMonth = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      );
      const lastDayLastMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        0,
      );
      return {
        from: formatLocalYmd(firstDayLastMonth),
        to: formatLocalYmd(lastDayLastMonth),
      };
    }
    case "CUSTOM":
      return {
        from: customFrom?.trim() || undefined,
        to: customTo?.trim() || undefined,
      };
    default:
      return {};
  }
}

export default function TransactionsPage() {
  const [rows, setRows] = useState<RemittanceTransferRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [lookups, setLookups] = useState<Lookups | null>(null);

  const [refInput, setRefInput] = useState("");
  /** Last applied reference (empty-state copy + refresh after modal). */
  const [appliedRef, setAppliedRef] = useState("");

  const [dateRangePreset, setDateRangePreset] =
    useState<DateRangePreset>("ALL");
  const [customFromInput, setCustomFromInput] = useState("");
  const [customToInput, setCustomToInput] = useState("");
  const [customRangeError, setCustomRangeError] = useState("");
  const [appliedDateRangePreset, setAppliedDateRangePreset] =
    useState<DateRangePreset>("ALL");
  const [appliedCustomFrom, setAppliedCustomFrom] = useState("");
  const [appliedCustomTo, setAppliedCustomTo] = useState("");

  const [viewId, setViewId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogFields | null>(null);
  const [tablePage, setTablePage] = useState(1);

  const appliedRefRef = useRef(appliedRef);
  appliedRefRef.current = appliedRef;

  const buildQueryParams = useCallback(
    (
      ref: string,
      preset: DateRangePreset,
      customFrom: string,
      customTo: string,
    ) => {
      const p: Record<string, string> = { limit: "200" };
      if (ref.trim()) p.reference = ref.trim();

      const range = computeDateRange(preset, customFrom, customTo);
      if (range.from) p.from = range.from;
      if (range.to) p.to = range.to;

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
        console.error("Error loading transfers:", e);
        const errorMsg = apiErrorMessage(
          e,
          "Check your connection and try again.",
        );
        setDialog({
          variant: "error",
          title: "Could not load transactions",
          message: errorMsg + " You can refresh the page to retry.",
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

  const applyDateRangeFilter = useCallback(
    (
      preset: DateRangePreset,
      customFrom: string,
      customTo: string,
      refForQuery: string,
    ) => {
      if (preset === "CUSTOM") {
        const err = validateCustomRange(customFrom, customTo);
        if (err) {
          setCustomRangeError(err);
          return;
        }
        setCustomRangeError("");
      } else {
        setCustomRangeError("");
      }

      setAppliedDateRangePreset(preset);
      setAppliedCustomFrom(customFrom.trim());
      setAppliedCustomTo(customTo.trim());
      void loadTransfers(
        buildQueryParams(refForQuery, preset, customFrom, customTo),
        { quiet: true },
      );
    },
    [buildQueryParams, loadTransfers],
  );

  const applyReferenceFilter = () => {
    const r = refInput.trim();
    setAppliedRef(r);
    void loadTransfers(
      buildQueryParams(
        r,
        appliedDateRangePreset,
        appliedCustomFrom,
        appliedCustomTo,
      ),
      { quiet: true },
    );
  };

  const handleSelectDatePreset = (preset: DateRangePreset) => {
    setDateRangePreset(preset);
    if (preset !== "CUSTOM") {
      setCustomFromInput("");
      setCustomToInput("");
      applyDateRangeFilter(preset, "", "", appliedRef);
    } else {
      setCustomRangeError("");
    }
  };

  useEffect(() => {
    if (dateRangePreset !== "CUSTOM") return;
    const from = customFromInput.trim();
    const to = customToInput.trim();
    if (!from && !to) {
      setCustomRangeError("");
      return;
    }
    const err = validateCustomRange(from, to);
    if (err) {
      setCustomRangeError(err);
      return;
    }
    setCustomRangeError("");
    applyDateRangeFilter("CUSTOM", from, to, appliedRefRef.current);
  }, [customFromInput, customToInput, dateRangePreset, applyDateRangeFilter]);

  const clearFilters = () => {
    setRefInput("");
    setDateRangePreset("ALL");
    setCustomFromInput("");
    setCustomToInput("");
    setCustomRangeError("");
    setAppliedRef("");
    setAppliedDateRangePreset("ALL");
    setAppliedCustomFrom("");
    setAppliedCustomTo("");
    void loadTransfers({ limit: "200" }, { quiet: true });
  };

  const refreshListWithAppliedFilters = useCallback(() => {
    void loadTransfers(
      buildQueryParams(
        appliedRef,
        appliedDateRangePreset,
        appliedCustomFrom,
        appliedCustomTo,
      ),
      {
        quiet: true,
      },
    );
  }, [
    loadTransfers,
    buildQueryParams,
    appliedRef,
    appliedDateRangePreset,
    appliedCustomFrom,
    appliedCustomTo,
  ]);

  useEffect(() => {
    setTablePage(1);
  }, [rows]);

  const totalTablePages = Math.max(
    1,
    Math.ceil(rows.length / TRANSACTIONS_PAGE_SIZE),
  );

  const paginatedRows = useMemo(() => {
    const start = (tablePage - 1) * TRANSACTIONS_PAGE_SIZE;
    return rows.slice(start, start + TRANSACTIONS_PAGE_SIZE);
  }, [rows, tablePage]);

  useEffect(() => {
    setTablePage((p) => Math.min(p, totalTablePages));
  }, [totalTablePages]);

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
    <div className="max-w-6xl mx-auto space-y-8 pb-10 relative">
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

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
            <input
              id="tx-ref"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyReferenceFilter();
              }}
              placeholder="Reference"
              className="min-w-[8rem] flex-1 h-9 px-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={applyReferenceFilter}
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

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">
            Date range
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                "ALL",
                "TODAY",
                "YESTERDAY",
                "LAST_7_DAYS",
                "LAST_30_DAYS",
                "THIS_MONTH",
                "LAST_MONTH",
                "CUSTOM",
              ] as const
            ).map((preset) => {
              const labels = {
                ALL: "All time",
                TODAY: "Today",
                YESTERDAY: "Yesterday",
                LAST_7_DAYS: "Last 7 Days",
                LAST_30_DAYS: "Last 30 Days",
                THIS_MONTH: "This month",
                LAST_MONTH: "Last month",
                CUSTOM: "Custom range",
              };

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectDatePreset(preset)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    dateRangePreset === preset
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          {dateRangePreset === "CUSTOM" && (
            <div className="pt-2 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor="custom-from"
                    className="text-xs text-slate-600 font-medium"
                  >
                    From
                  </label>
                  <input
                    id="custom-from"
                    type="date"
                    value={customFromInput}
                    onChange={(e) => setCustomFromInput(e.target.value)}
                    max={customToInput || undefined}
                    className={`w-full h-9 px-2.5 rounded-lg border text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 ${
                      customRangeError ? "border-red-300" : "border-slate-200"
                    }`}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor="custom-to"
                    className="text-xs text-slate-600 font-medium"
                  >
                    To
                  </label>
                  <input
                    id="custom-to"
                    type="date"
                    value={customToInput}
                    onChange={(e) => setCustomToInput(e.target.value)}
                    min={customFromInput || undefined}
                    className={`w-full h-9 px-2.5 rounded-lg border text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 ${
                      customRangeError ? "border-red-300" : "border-slate-200"
                    }`}
                  />
                </div>
              </div>
              {customRangeError ? (
                <p className="text-xs text-red-600" role="alert">
                  {customRangeError}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Results update automatically when both dates are selected
                  (inclusive range).
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-8 py-16 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
            <ArrowLeftRight className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {appliedRef || appliedDateRangePreset !== "ALL"
              ? "No transactions found"
              : "No transactions yet"}
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-6 max-w-sm mx-auto">
            {appliedRef || appliedDateRangePreset !== "ALL"
              ? (() => {
                  const parts: string[] = [];
                  if (appliedRef) parts.push(`reference "${appliedRef}"`);
                  if (appliedDateRangePreset !== "ALL") {
                    const labels = {
                      TODAY: "today",
                      YESTERDAY: "yesterday",
                      LAST_7_DAYS: "the last 7 days",
                      LAST_30_DAYS: "the last 30 days",
                      THIS_MONTH: "this month",
                      LAST_MONTH: "last month",
                      CUSTOM:
                        appliedCustomFrom && appliedCustomTo
                          ? `${appliedCustomFrom} to ${appliedCustomTo}`
                          : "your custom date range",
                    };
                    parts.push(
                      labels[appliedDateRangePreset] || "your selected dates",
                    );
                  }
                  return `No transactions match ${parts.join(" and ")}. Try adjusting your filters or check back later.`;
                })()
              : "When you complete a transfer in Send money, it will show up here."}
          </p>
          <Link
            href="/send-money"
            className="inline-flex items-center gap-2 h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
            {appliedRef || appliedDateRangePreset !== "ALL"
              ? "Start new transfer"
              : "Send money"}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <RemittanceTransfersTable
            rows={paginatedRows}
            onViewTransfer={(id) => setViewId(id)}
            onTransferUpdated={refreshListWithAppliedFilters}
          />
          {totalTablePages > 1 ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-1">
              <p className="text-sm text-slate-500 text-center sm:text-left">
                Showing {(tablePage - 1) * TRANSACTIONS_PAGE_SIZE + 1}–
                {Math.min(tablePage * TRANSACTIONS_PAGE_SIZE, rows.length)} of{" "}
                {rows.length}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                  disabled={tablePage <= 1}
                  className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-slate-500 tabular-nums px-2 min-w-[4.5rem] text-center">
                  Page {tablePage} / {totalTablePages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTablePage((p) => Math.min(totalTablePages, p + 1))
                  }
                  disabled={tablePage >= totalTablePages}
                  className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
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
