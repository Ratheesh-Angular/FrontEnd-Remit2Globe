import type { TransferReceiptPdfData } from "./transfer-receipt-pdf";
import { formatBeneficiaryName } from "./beneficiaryDisplay";

export type RemittanceTransferRow = {
  id: string;
  referenceCode: string;
  status: string;
  createdAt?: string;
  paymentProofs?: {
    id: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: string;
  }[];
  payCurrency?: string | null;
  payAmount?: unknown;
  feeAmount?: unknown;
  receiveCurrency?: string | null;
  receiveAmount?: unknown;
  fxRateSnapshot?: unknown;
  recipientCountryLabel?: string | null;
  payInMethod?: string | null;
  payerPhone?: string | null;
  sourceOfIncome?: string | null;
  transferPurpose?: string | null;
  relationshipToRecipient?: string | null;
  beneficiary?: {
    firstName: string;
    lastName: string;
    country?: string | null;
    deliveryChannel: "BANK_TRANSFER" | "MOBILE_MONEY";
    bankName?: string | null;
    branchName?: string | null;
    accountNumber?: string | null;
    mobileMoneyProvider?: string | null;
    mobileNumber?: string | null;
  } | null;
};

type LookupList = { value: string; label: string }[];

export function buildTransferReceiptDataFromRow(
  t: RemittanceTransferRow,
  lookups: {
    sourceOfIncome: LookupList;
    transferPurpose: LookupList;
    relationship: LookupList;
  } | null,
): TransferReceiptPdfData | null {
  const ben = t.beneficiary;
  if (!ben) return null;
  if (!t.payCurrency || t.payAmount == null) return null;

  const youSend = Number(t.payAmount);
  const fee =
    t.feeAmount != null && t.feeAmount !== ""
      ? Number(t.feeAmount as { toString(): string } | number)
      : 0;
  const receive =
    t.receiveAmount != null && t.receiveAmount !== ""
      ? Number(t.receiveAmount as { toString(): string } | number)
      : null;

  const rateSnap =
    t.fxRateSnapshot != null && t.fxRateSnapshot !== ""
      ? Number(t.fxRateSnapshot as { toString(): string } | number)
      : null;

  const payInIsMobile = t.payInMethod === "MOBILE_MONEY";
  const recipientCountry =
    (t.recipientCountryLabel ?? ben.country ?? "").trim() || "—";
  return {
    referenceCode: t.referenceCode,
    status: t.status,
    generatedAt: new Date(),
    amounts: {
      fromCurrency: t.payCurrency,
      toCurrency: (t.receiveCurrency ?? "—").toString(),
      youSend,
      fee,
      totalToPay: youSend + fee,
      receive: receive,
      hasRate: rateSnap != null,
      rate: rateSnap,
    },
    recipientCountry,
    beneficiary: {
      displayName: formatBeneficiaryName(ben),
      deliveryLabel:
        ben.deliveryChannel === "BANK_TRANSFER"
          ? "Bank transfer"
          : "Mobile money",
      payoutDetails: payoutLine(ben),
    },
    compliance:
      t.sourceOfIncome && t.transferPurpose && t.relationshipToRecipient
        ? {
            source: labelOrRaw(
              lookups?.sourceOfIncome,
              t.sourceOfIncome,
            ),
            purpose: labelOrRaw(
              lookups?.transferPurpose,
              t.transferPurpose,
            ),
            relationship: labelOrRaw(
              lookups?.relationship,
              t.relationshipToRecipient,
            ),
          }
        : null,
    payInLabel: payInIsMobile
      ? "Mobile money (STK / collection to us)"
      : "Bank transfer to our company account",
    payerPhone: payInIsMobile
      ? (t.payerPhone?.trim() || null)
      : null,
  };
}

function labelOrRaw(
  list: LookupList | undefined,
  value: string,
): string {
  if (!list?.length) return value;
  return list.find((o) => o.value === value)?.label ?? value;
}

function maskAcc(n?: string | null) {
  if (!n || n.length < 4) return "····";
  return `····${n.replace(/\s/g, "").slice(-4)}`;
}

function payoutLine(
  b: NonNullable<RemittanceTransferRow["beneficiary"]>,
): string {
  if (b.deliveryChannel === "BANK_TRANSFER") {
    return [b.bankName, b.branchName, b.accountNumber ? `Account ${maskAcc(b.accountNumber)}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  return (
    [b.mobileMoneyProvider, b.mobileNumber].filter(Boolean).join(" · ") || "—"
  );
}
