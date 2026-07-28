/** Flex API response codes — see response-codes.md at repo root. */

export const FLEX_RESPONSE_CODE_LABELS: Record<string, string> = {
  "0": "Paid out",
  "100": "Success",
  "-1": "Not allowed",
  "1002": "Phone number not found",
  "2001": "Rejected — sanctions list match",
  "2002": "Rejected — EU sanctions list match",
  "2003": "Rejected — UN sanctions list match",
  "2004": "Rejected — unsupported customer type",
  "2005": "Rejected — would exceed maximum balance",
  "2006": "Cancelled",
  "2007": "Insufficient balance",
  "2008": "Rejected — exceeds maximum transaction amount",
  "2009": "Rejected — invalid receiver details",
  "2010": "Rejected — invalid recipient state",
  "2011": "Rejected by you",
  "2012": "Payment timed out",
  "3000": "Pending",
  "3001": "Approved",
  "3002": "Approved (bank)",
  "3003": "Auto-pending",
  "3004": "Processing",
  "3005": "Other error",
};

export const RETRYABLE_STK_FAILURE_CODES = new Set([
  "2006",
  "2007",
  "2011",
  "2012",
  "3005",
]);

const GENERIC_FAILURE_TEXT = new Set(
  ["success", "paid out", "pending", ""].map((s) => s.toLowerCase()),
);

const CODE_IN_TEXT_RE = /\b(?:code|unknown code)\s*(-?\d+)\b/i;

function isBareFlexCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return trimmed;
  return null;
}

function extractCodeFromText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const bare = isBareFlexCode(value);
  if (bare) return bare;
  const match = value.match(CODE_IN_TEXT_RE);
  return match?.[1] ?? null;
}

function matchCodeFromStatusText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const lower = text.trim().toLowerCase();
  for (const [code, label] of Object.entries(FLEX_RESPONSE_CODE_LABELS)) {
    if (label.toLowerCase() === lower) return code;
  }
  if (lower.includes("cancelled by user") || lower.includes("canceled by user")) {
    return "2011";
  }
  if (lower.includes("insufficient")) return "2007";
  if (lower.includes("timeout")) return "2012";
  return null;
}

export type FlexTransferFields = {
  status: string;
  payInMethod?: string | null;
  failureReason?: string | null;
  flexStkStatus?: string | null;
  flexPayoutStatus?: string | null;
};

export function extractFlexErrorCode(input: FlexTransferFields): string | null {
  return (
    extractCodeFromText(input.failureReason) ??
    isBareFlexCode(input.flexStkStatus) ??
    isBareFlexCode(input.flexPayoutStatus) ??
    matchCodeFromStatusText(input.failureReason) ??
    matchCodeFromStatusText(input.flexStkStatus) ??
    matchCodeFromStatusText(input.flexPayoutStatus)
  );
}

function pickMeaningfulStatusText(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const raw of candidates) {
    const text = raw?.trim();
    if (!text) continue;
    if (GENERIC_FAILURE_TEXT.has(text.toLowerCase())) continue;
    return text;
  }
  return null;
}

const BASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending payment",
  PAYMENT_SUBMITTED: "Payment submitted",
  UNDER_REVIEW: "Under review",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

function hasStkFailureContext(transfer: FlexTransferFields): boolean {
  const code = extractFlexErrorCode(transfer);
  if (code && RETRYABLE_STK_FAILURE_CODES.has(code)) return true;
  if (transfer.status === "FAILED") return true;
  return (
    transfer.status === "PENDING_PAYMENT" &&
    !!pickMeaningfulStatusText(transfer.failureReason, transfer.flexStkStatus)
  );
}

export function resolveTransferStatusDisplay(transfer: FlexTransferFields): string {
  if (hasStkFailureContext(transfer)) {
    const code = extractFlexErrorCode(transfer);
    if (code && FLEX_RESPONSE_CODE_LABELS[code]) {
      return FLEX_RESPONSE_CODE_LABELS[code];
    }
    const meaningful = pickMeaningfulStatusText(
      transfer.failureReason,
      transfer.flexStkStatus,
    );
    if (meaningful) return meaningful;
    if (transfer.status === "FAILED") return "Failed";
  }

  return BASE_STATUS_LABELS[transfer.status] ?? transfer.status.replace(/_/g, " ");
}

export function resolveTransferFailureDetail(
  transfer: FlexTransferFields,
): string | null {
  if (!hasStkFailureContext(transfer)) return null;

  const code = extractFlexErrorCode(transfer);
  const meaningful = pickMeaningfulStatusText(
    transfer.failureReason,
    transfer.flexStkStatus,
  );

  if (code === "2011") {
    return "You cancelled the mobile money prompt on your phone. You can retry when ready.";
  }
  if (code === "2007") {
    return "Your mobile money wallet did not have enough funds. Top up and try again.";
  }
  if (code === "2012") {
    return "The payment request timed out. Tap retry to send a new prompt to your phone.";
  }
  if (meaningful) return meaningful;
  return null;
}

export function canRetryMobileMoneyPayment(transfer: FlexTransferFields): boolean {
  if (transfer.payInMethod !== "MOBILE_MONEY") return false;

  const code = extractFlexErrorCode(transfer);
  if (!code || !RETRYABLE_STK_FAILURE_CODES.has(code)) return false;

  if (transfer.status === "FAILED") return true;

  return (
    transfer.status === "PENDING_PAYMENT" &&
    !!pickMeaningfulStatusText(transfer.failureReason, transfer.flexStkStatus)
  );
}

export function statusBadgeClassForTransfer(transfer: FlexTransferFields): string {
  const status = transfer.status;

  if (canRetryMobileMoneyPayment(transfer)) {
    return "bg-amber-50 text-amber-900 border-amber-200";
  }

  if (status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (status === "FAILED" || status === "CANCELLED") {
    return "bg-red-50 text-red-800 border-red-200";
  }
  if (status === "PENDING_PAYMENT") {
    return "bg-amber-50 text-amber-900 border-amber-200";
  }
  if (
    status === "PROCESSING" ||
    status === "UNDER_REVIEW" ||
    status === "PAYMENT_SUBMITTED"
  ) {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}
