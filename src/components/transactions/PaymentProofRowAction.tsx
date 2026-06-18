"use client";

import { useRef, useState } from "react";
import { sessionApi as api } from "@/lib/api";
import type { RemittanceTransferRow } from "@/lib/transfer-receipt-from-transfer";
import {
  PAYMENT_PROOF_ACCEPT,
  canUploadPaymentProof,
  getLatestPaymentProof,
  hasPaymentProofs,
  openPaymentProof,
  paymentProofUploadErrorMessage,
  showPaymentProofRowAction,
  uploadPaymentProof,
} from "@/lib/payment-proof";
import { PaymentProofLightbox } from "@/components/transactions/PaymentProofLightbox";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyError } from "@/lib/notify";
import { FileText, Upload } from "lucide-react";

export type PaymentProofRowActionProps = {
  transfer: RemittanceTransferRow;
  onUploaded?: () => void;
};

export function PaymentProofRowAction({
  transfer,
  onUploaded,
}: PaymentProofRowActionProps) {
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!showPaymentProofRowAction(transfer)) return null;

  const hasProof = hasPaymentProofs(transfer);
  const canUpload = canUploadPaymentProof(transfer);
  const latestProof = getLatestPaymentProof(transfer);

  async function handleProofFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploadBusy(true);
    try {
      await uploadPaymentProof(transfer.id, fileList, api);
      onUploaded?.();
    } catch (e: unknown) {
      notifyError(paymentProofUploadErrorMessage(e));
    } finally {
      setUploadBusy(false);
      if (proofInputRef.current) proofInputRef.current.value = "";
    }
  }

  const buttonClass =
    "cursor-pointer inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
      <AppLoadingOverlay show={uploadBusy} label="Uploading proof…" />
      {canUpload ? (
        <>
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
            className={buttonClass}
            title="Upload payment proof"
            aria-label="Upload payment proof"
          >
            <Upload className="w-4 h-4" aria-hidden />
          </button>
        </>
      ) : hasProof && latestProof ? (
        <button
          type="button"
          onClick={() => openPaymentProof(latestProof, setLightboxUrl)}
          className={buttonClass}
          title="View payment proof"
          aria-label="View payment proof"
        >
          <FileText className="w-4 h-4" aria-hidden />
        </button>
      ) : null}

      <PaymentProofLightbox
        url={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
      />
    </>
  );
}
