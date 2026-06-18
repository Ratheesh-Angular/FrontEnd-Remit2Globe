"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sessionApi as api } from "@/lib/api";
import {
  formatBeneficiaryName,
  maskAccountLast4,
  maskPhoneLast4,
} from "@/lib/beneficiaryDisplay";
import { downloadTransferReceiptPdf } from "@/lib/transfer-receipt-pdf";
import {
  buildTransferReceiptDataFromRow,
  type RemittanceTransferRow,
} from "@/lib/transfer-receipt-from-transfer";
import { PaymentProofLightbox } from "@/components/transactions/PaymentProofLightbox";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { Loader } from "@/components/ui/Loader";
import { notifyError } from "@/lib/notify";
import {
  PAYMENT_PROOF_ACCEPT,
  canUploadMorePaymentProof,
  getPaymentProofs,
  isImageMime,
  openPaymentProof,
  paymentProofUploadErrorMessage,
  uploadPaymentProof,
} from "@/lib/payment-proof";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Upload,
} from "lucide-react";

type Lookups = {
  sourceOfIncome: { value: string; label: string }[];
  transferPurpose: { value: string; label: string }[];
  relationship: { value: string; label: string }[];
};

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

function statusLabel(s: string) {
  const map: Record<string, string> = {
    DRAFT: "Draft",
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
  return "bg-slate-50 text-slate-800 border-slate-200";
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string | undefined) {
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

export type ViewTransactionModalProps = {
  open: boolean;
  transferId: string | null;
  onClose: () => void;
  lookups: Lookups | null;
  /** After proof upload, refresh the transactions list. */
  onTransferUpdated?: () => void;
};

export function ViewTransactionModal({
  open,
  transferId,
  onClose,
  lookups,
  onTransferUpdated,
}: ViewTransactionModalProps) {
  const [row, setRow] = useState<RemittanceTransferRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !transferId) {
      setRow(null);
      setLoadFailed(false);
      setLightboxUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    void api
      .get<{
        data: { transfer: RemittanceTransferRow & { createdAt?: string } };
      }>(`/remittance/transfers/${transferId}`)
      .then((res) => {
        if (!cancelled) setRow(res.data.data.transfer as RemittanceTransferRow);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
          notifyError("Could not load transfer.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, transferId]);

  async function reloadTransfer() {
    if (!transferId) return;
    try {
      const res = await api.get<{
        data: { transfer: RemittanceTransferRow & { createdAt?: string } };
      }>(`/remittance/transfers/${transferId}`);
      setRow(res.data.data.transfer as RemittanceTransferRow);
    } catch {
      /* ignore; row may still be partial */
    }
  }

  async function handleProofFiles(fileList: FileList | null) {
    if (!fileList?.length || !transferId) return;
    setUploadBusy(true);
    try {
      await uploadPaymentProof(transferId, fileList, api);
      await reloadTransfer();
      onTransferUpdated?.();
    } catch (e: unknown) {
      notifyError(paymentProofUploadErrorMessage(e));
    } finally {
      setUploadBusy(false);
      if (proofInputRef.current) proofInputRef.current.value = "";
    }
  }

  const receiptPayload = useMemo(() => {
    if (!row) return null;
    return buildTransferReceiptDataFromRow(row, lookups);
  }, [row, lookups]);

  const proofs = row ? getPaymentProofs(row) : [];

  const canUploadMoreProof = row && canUploadMorePaymentProof(row);

  const totalToPay =
    row && row.payCurrency && row.payAmount != null
      ? Number(row.payAmount) + Number(row.feeAmount ?? 0)
      : null;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80 relative sm:max-w-2xl">
          <AppLoadingOverlay show={uploadBusy} label="Uploading proof…" />
          <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 mb-1">
                Transfer
              </p>
              {loading ? (
                <div className="h-7 w-56 bg-slate-200 rounded animate-pulse" />
              ) : loadFailed ? (
                <h2 className="text-lg font-semibold text-slate-600">
                  Could not load transfer
                </h2>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-slate-900 font-mono tracking-tight">
                    {row?.referenceCode ?? "—"}
                  </h2>
                  {row && (
                    <>
                      {totalToPay != null && row.payCurrency && (
                        <p className="text-sm text-slate-700 mt-2">
                          Total to pay:{" "}
                          <span className="font-bold tabular-nums text-slate-900">
                            {fmtMoney(totalToPay)} {row.payCurrency}
                          </span>
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${statusBadgeClass(row.status)}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {fmtDate(row.createdAt)}
                        </span>
                      </div>
                    </>
                  )}
                </>
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

          <div className="flex-1 overflow-y-auto px-5 py-2 relative min-h-[160px]">
            {loading && (
              <Loader
                variant="centered"
                className="py-12"
                size="lg"
                label="Loading transfer…"
              />
            )}
            {!loading && !loadFailed && row && (
              <div className="space-y-2 pb-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">
                    Amounts
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">You pay</span>
                      <p className="font-semibold text-slate-900 tabular-nums">
                        {row.payCurrency && row.payAmount != null
                          ? `${fmtMoney(Number(row.payAmount))} ${row.payCurrency}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Fee</span>
                      <p className="font-semibold text-slate-900 tabular-nums">
                        {row.payCurrency && row.feeAmount != null
                          ? `${fmtMoney(Number(row.feeAmount))} ${row.payCurrency}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Recipient gets</span>
                      <p className="font-semibold text-slate-900 tabular-nums">
                        {row.receiveCurrency && row.receiveAmount != null
                          ? `${fmtMoney(Number(row.receiveAmount))} ${row.receiveCurrency}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Corridor</span>
                      <p className="text-slate-800">
                        {(row.recipientCountryLabel ?? "").trim() || "—"}
                      </p>
                    </div>
                  </div>
                  {/* {totalToPay != null && row.payCurrency && (
                    <div className="mb-3 mt-3 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-teal-900">
                        Total to pay
                      </span>
                      <span className="text-base font-bold text-teal-950 tabular-nums">
                        {fmtMoney(totalToPay)} {row.payCurrency}
                      </span>
                    </div>
                  )} */}
                </div>

                <div className="rounded-xl border border-slate-200 p-0 overflow-hidden">
                  <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-teal-800 bg-teal-50/80 border-b border-teal-100">
                    Pay-in
                  </p>
                  <dl className="px-4">
                    <Detail
                      label="Method"
                      value={
                        row.payInMethod === "MOBILE_MONEY"
                          ? "Mobile money"
                          : row.payInMethod === "BANK_TRANSFER"
                            ? "Bank transfer"
                            : (row.payInMethod ?? "—")
                      }
                    />
                    {row.payInMethod === "MOBILE_MONEY" && (
                      <Detail
                        label="Payer number"
                        value={row.payerPhone ?? undefined}
                        mono
                      />
                    )}
                  </dl>
                </div>

                {row.beneficiary && (
                  <div className="rounded-xl border border-slate-200 p-0 overflow-hidden">
                    <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-teal-800 bg-teal-50/80 border-b border-teal-100">
                      Beneficiary
                    </p>
                    <dl className="px-4">
                      <Detail
                        label="Name"
                        value={formatBeneficiaryName(row.beneficiary)}
                      />
                      <Detail
                        label="Delivery"
                        value={
                          row.beneficiary.deliveryChannel === "BANK_TRANSFER"
                            ? "Bank transfer"
                            : "Mobile money"
                        }
                      />
                      {row.beneficiary.deliveryChannel === "BANK_TRANSFER" ? (
                        <>
                          <Detail
                            label="Bank"
                            value={row.beneficiary.bankName ?? undefined}
                          />
                          <Detail
                            label="Account (masked)"
                            value={maskAccountLast4(
                              row.beneficiary.accountNumber,
                            )}
                            mono
                          />
                        </>
                      ) : (
                        <>
                          <Detail
                            label="Provider"
                            value={
                              row.beneficiary.mobileMoneyProvider ?? undefined
                            }
                          />
                          <Detail
                            label="Number (masked)"
                            value={maskPhoneLast4(row.beneficiary.mobileNumber)}
                            mono
                          />
                        </>
                      )}
                    </dl>
                  </div>
                )}

                {(row.sourceOfIncome ||
                  row.transferPurpose ||
                  row.relationshipToRecipient) && (
                  <div className="rounded-xl border border-slate-200 p-0 overflow-hidden">
                    <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-teal-800 bg-teal-50/80 border-b border-teal-100">
                      Source, purpose & relationship
                    </p>
                    <dl className="px-4">
                      <Detail
                        label="Source of funds"
                        value={
                          lookups
                            ? (lookups.sourceOfIncome.find(
                                (o) => o.value === row.sourceOfIncome,
                              )?.label ?? row.sourceOfIncome)
                            : row.sourceOfIncome
                        }
                      />
                      <Detail
                        label="Transfer purpose"
                        value={
                          lookups
                            ? (lookups.transferPurpose.find(
                                (o) => o.value === row.transferPurpose,
                              )?.label ?? row.transferPurpose)
                            : row.transferPurpose
                        }
                      />
                      <Detail
                        label="Relationship"
                        value={
                          lookups
                            ? (lookups.relationship.find(
                                (o) => o.value === row.relationshipToRecipient,
                              )?.label ?? row.relationshipToRecipient)
                            : row.relationshipToRecipient
                        }
                      />
                    </dl>
                  </div>
                )}

                {row?.payInMethod === "BANK_TRANSFER" && (
                  <div className="rounded-xl border border-slate-200 p-0 overflow-hidden">
                    <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 bg-slate-50 border-b border-slate-200">
                      Payment proof ({proofs.length})
                    </p>
                    {canUploadMoreProof && (
                      <div className="px-4 py-3 border-b border-slate-100">
                        <div className="rounded-lg border border-dashed border-teal-200/80 bg-white p-3 text-left">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <p className="text-xs text-slate-600 flex-1 min-w-0">
                              <span className="font-medium text-slate-800">
                                {proofs.length === 0
                                  ? "Upload payment proof"
                                  : "Add another file"}
                              </span>
                              <span className="block text-[11px] text-slate-500 mt-0.5">
                                Receipts or screenshots help us match your bank
                                payment. Same formats as in Send money.
                              </span>
                            </p>
                            <div className="shrink-0 flex justify-end">
                              <input
                                ref={proofInputRef}
                                type="file"
                                className="sr-only"
                                accept={PAYMENT_PROOF_ACCEPT}
                                multiple
                                disabled={uploadBusy}
                                onChange={(e) => {
                                  void handleProofFiles(e.target.files);
                                }}
                              />
                              <button
                                type="button"
                                disabled={uploadBusy}
                                onClick={() => proofInputRef.current?.click()}
                                className="h-8 px-3 rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {uploadBusy ? (
                                  "Uploading…"
                                ) : (
                                  <>
                                    <Upload
                                      className="w-3.5 h-3.5 shrink-0"
                                      aria-hidden
                                    />
                                    Upload
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {row &&
                      !canUploadMoreProof &&
                      row.status !== "PENDING_PAYMENT" && (
                        <p className="px-4 py-3 text-xs text-slate-500 border-b border-slate-100">
                          Payment proof can no longer be added for this transfer
                          status.
                        </p>
                      )}
                    {proofs.length === 0 &&
                    !canUploadMoreProof ? (
                      <p className="px-4 py-6 text-sm text-slate-500 text-center">
                        No files uploaded for this transfer.
                      </p>
                    ) : proofs.length === 0 ? null : (
                      <ul className="divide-y divide-slate-100">
                        {proofs.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80"
                          >
                            <div className="shrink-0 text-slate-400">
                              {isImageMime(p.mimeType) ? (
                                <ImageIcon className="w-5 h-5" />
                              ) : (
                                <FileText className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {p.fileName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {fmtDate(p.uploadedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openPaymentProof(p, setLightboxUrl)
                                }
                                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                View
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
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
            <button
              type="button"
              disabled={!receiptPayload}
              onClick={() => {
                if (receiptPayload) {
                  downloadTransferReceiptPdf(receiptPayload);
                }
              }}
              className="flex-1 h-10 inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download receipt
            </button>
          </div>
        </div>
      </div>

      <PaymentProofLightbox
        url={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
      />
    </>
  );
}
