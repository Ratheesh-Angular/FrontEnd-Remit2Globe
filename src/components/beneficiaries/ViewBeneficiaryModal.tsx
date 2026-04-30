"use client";

import { useEffect, useState } from "react";
import { sessionApi as api } from "@/lib/api";
import { formatBeneficiaryName } from "@/lib/beneficiaryDisplay";
import type { CreatedBeneficiaryPayload } from "./AddBeneficiaryModal";
import { AppDialog } from "@/components/ui/AppDialog";
import type { AppDialogProps } from "@/components/ui/AppDialog";
import { Loader } from "@/components/ui/Loader";
import { Pencil, Trash2, X } from "lucide-react";

type BeneficiaryDetail = CreatedBeneficiaryPayload & { id: string };

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

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const v = value?.trim();
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
        {label}
      </dt>
      <dd
        className={`text-sm text-slate-900 break-words ${mono ? "font-mono text-[13px]" : ""}`}
      >
        {v || "—"}
      </dd>
    </div>
  );
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback
  );
}

export type ViewBeneficiaryModalProps = {
  open: boolean;
  beneficiaryId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDeleted?: () => void;
};

export function ViewBeneficiaryModal({
  open,
  beneficiaryId,
  onClose,
  onEdit,
  onDeleted,
}: ViewBeneficiaryModalProps) {
  const [row, setRow] = useState<BeneficiaryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<DialogFields | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  useEffect(() => {
    if (!open || !beneficiaryId) {
      setRow(null);
      setError("");
      setDialog(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void api
      .get<{ data: { beneficiary: BeneficiaryDetail } }>(
        `/beneficiaries/${beneficiaryId}`,
      )
      .then((res) => {
        if (!cancelled) setRow(res.data.data.beneficiary);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load beneficiary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, beneficiaryId]);

  if (!open || !beneficiaryId) return null;

  const isBank = row?.deliveryChannel === "BANK_TRANSFER";
  const displayName = row ? formatBeneficiaryName(row) : "";

  function requestDelete() {
    if (!beneficiaryId || !row) return;
    setDialog({
      variant: "confirm",
      title: "Remove beneficiary?",
      message: `${displayName} will be removed permanently. This cannot be undone.`,
      destructive: true,
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setDialogLoading(true);
        try {
          await api.delete(`/beneficiaries/${beneficiaryId}`);
          setDialog(null);
          onDeleted?.();
          onClose();
        } catch (e: unknown) {
          setDialog({
            variant: "error",
            title: "Could not remove beneficiary",
            message: apiErrorMessage(e, "Please try again."),
          });
        } finally {
          setDialogLoading(false);
        }
      },
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80 relative">
          <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 mb-1">
                Beneficiary
              </p>
              {loading ? (
                <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
              ) : error ? (
                <h2 className="text-lg font-semibold text-red-600">{error}</h2>
              ) : (
                <h2 className="text-lg font-semibold text-slate-900 truncate">
                  {row ? formatBeneficiaryName(row) : "—"}
                </h2>
              )}
              {row && (
                <span
                  className={`inline-flex mt-2 text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    isBank
                      ? "bg-sky-100 text-sky-800"
                      : "bg-violet-100 text-violet-800"
                  }`}
                >
                  {isBank ? "Bank transfer" : "Mobile money"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-2 relative min-h-[120px]">
            {loading && (
              <Loader
                variant="centered"
                className="py-12"
                size="lg"
                label="Loading details…"
              />
            )}
            {!loading && !error && row && (
              <dl>
                <Detail label="First name" value={row.firstName} />
                <Detail label="Last name" value={row.lastName} />
                <Detail label="Country" value={row.country} />
                <Detail
                  label="Send money"
                  value={
                    row.active === false
                      ? "Inactive (hidden in Send money)"
                      : "Active"
                  }
                />
                {isBank ? (
                  <>
                    <Detail label="Bank name" value={row.bankName} />
                    <Detail label="Branch" value={row.branchName} />
                    <Detail
                      label="Account number / IBAN"
                      value={row.accountNumber}
                      mono
                    />
                    <Detail
                      label="IFSC / SWIFT / Routing"
                      value={row.swiftBic}
                      mono
                    />
                  </>
                ) : (
                  <>
                    <Detail
                      label="Mobile money provider"
                      value={row.mobileMoneyProvider}
                    />
                    <Detail
                      label="Mobile number"
                      value={row.mobileNumber}
                      mono
                    />
                  </>
                )}
              </dl>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            {/* <button
              type="button"
              disabled={!row || !!error}
              onClick={() => {
                if (beneficiaryId) {
                  onEdit(beneficiaryId);
                  onClose();
                }
              }}
              className="flex-1 h-10 inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              type="button"
              disabled={!row || !!error}
              onClick={() => requestDelete()}
              className="flex-1 h-10 inline-flex items-center justify-center gap-2 border border-red-200 bg-white text-red-700 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button> */}
          </div>
        </div>
      </div>

      {dialog ? (
        <AppDialog
          open
          onClose={() => {
            if (!dialogLoading) setDialog(null);
          }}
          loading={dialogLoading}
          variant={dialog.variant}
          title={dialog.title}
          message={dialog.message}
          destructive={dialog.destructive}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          onConfirm={dialog.onConfirm}
        />
      ) : null}
    </>
  );
}
