/**
 * User-facing KYC rejection copy shared across result, profile, and dashboard.
 */

export const KYC_SUPPORT_EMAIL = "customercare@flex-money.com";

export const KYC_REJECTION_SUPPORT_MESSAGE =
  "For this reason, your KYC has failed. One of our support team members will contact you and help you complete the KYC process. You can also contact our support team directly via the following email address: customercare@flex-money.com";

const CHECK_LABELS: Record<string, string> = {
  imageQualityPass: "document image quality",
  documentNotExpired: "document expiry date",
  livenessPass: "liveness verification",
  livenessScoreGood: "liveness score",
  faceMatchPass: "face match",
  faceMatchScoreGood: "face match score",
};

/** Turn technical Signzy check keys into a short plain-language reason. */
export function humanizeKycDecisionReason(
  raw: string | null | undefined,
): string {
  const text = (raw || "").trim();
  if (!text) {
    return "One or more identity verification checks did not pass";
  }

  const failedMatch = text.match(/^Failed:\s*(.+)$/i);
  if (failedMatch) {
    const parts = failedMatch[1]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((key) => CHECK_LABELS[key] || key);
    if (parts.length === 1) {
      return `Your ${parts[0]} check did not pass`;
    }
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      const head = parts.slice(0, -1).join(", ");
      return `The following checks did not pass: ${head}, and ${last}`;
    }
  }

  if (/awaiting full journey data|Incomplete/i.test(text)) {
    return "We could not confirm your verification results yet";
  }

  // Already human-readable admin message, etc.
  return text;
}

export function buildKycRejectionDisplay(rawReason?: string | null): {
  reason: string;
  supportMessage: string;
} {
  return {
    reason: humanizeKycDecisionReason(rawReason),
    supportMessage: KYC_REJECTION_SUPPORT_MESSAGE,
  };
}
