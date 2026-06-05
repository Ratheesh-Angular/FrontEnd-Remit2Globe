import type { AxiosInstance } from "axios";
import type { RemittanceTransferRow } from "@/lib/transfer-receipt-from-transfer";

export const PAYMENT_PROOF_ACCEPT =
  "image/*,.pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.csv,.heic,.heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/rtf";

export type PaymentProofItem = NonNullable<
  RemittanceTransferRow["paymentProofs"]
>[number];

export function isImageMime(m: string) {
  return /^image\//i.test(m);
}

export function getPaymentProofs(
  row: Pick<RemittanceTransferRow, "paymentProofs">,
): PaymentProofItem[] {
  const proofs = row.paymentProofs;
  return Array.isArray(proofs) ? proofs : [];
}

export function hasPaymentProofs(
  row: Pick<RemittanceTransferRow, "paymentProofs">,
): boolean {
  return getPaymentProofs(row).length > 0;
}

export function getLatestPaymentProof(
  row: Pick<RemittanceTransferRow, "paymentProofs">,
): PaymentProofItem | null {
  const proofs = getPaymentProofs(row);
  return proofs.length > 0 ? proofs[proofs.length - 1]! : null;
}

export function isBankTransferPayIn(
  row: Pick<RemittanceTransferRow, "payInMethod">,
): boolean {
  return row.payInMethod === "BANK_TRANSFER";
}

/** Modal: bank transfer pending payment may upload (including additional files). */
export function canUploadMorePaymentProof(
  row: Pick<RemittanceTransferRow, "payInMethod" | "status">,
): boolean {
  return isBankTransferPayIn(row) && row.status === "PENDING_PAYMENT";
}

/** Table row: upload icon only when pending and no proof yet. */
export function canUploadPaymentProof(
  row: Pick<RemittanceTransferRow, "payInMethod" | "status" | "paymentProofs">,
): boolean {
  return canUploadMorePaymentProof(row) && !hasPaymentProofs(row);
}

export function showPaymentProofRowAction(
  row: Pick<RemittanceTransferRow, "payInMethod" | "status" | "paymentProofs">,
): boolean {
  if (!isBankTransferPayIn(row)) return false;
  return hasPaymentProofs(row) || canUploadPaymentProof(row);
}

export function openPaymentProof(
  proof: Pick<PaymentProofItem, "fileUrl" | "mimeType">,
  setLightboxUrl?: (url: string) => void,
) {
  if (isImageMime(proof.mimeType)) {
    setLightboxUrl?.(proof.fileUrl);
  } else {
    window.open(proof.fileUrl, "_blank", "noopener,noreferrer");
  }
}

export function paymentProofUploadErrorMessage(error: unknown): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ??
    "Upload failed. Try a smaller file or a different format."
  );
}

export async function uploadPaymentProof(
  transferId: string,
  fileList: FileList | null,
  api: AxiosInstance,
): Promise<{ id: string; fileName: string }[]> {
  if (!fileList?.length) return [];
  const formData = new FormData();
  for (const f of Array.from(fileList)) {
    formData.append("files", f);
  }
  const res = await api.post<{
    data: { proofs: { id: string; fileName: string }[] };
  }>(`/remittance/transfers/${transferId}/payment-proof`, formData, {
    transformRequest: [
      (data, headers) => {
        if (data instanceof FormData) {
          delete headers["Content-Type"];
        }
        return data;
      },
    ],
  });
  return res.data.data.proofs;
}
