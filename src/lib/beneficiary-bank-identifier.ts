/** Flex / ISO 3166-1 alpha-3 corridor codes → label + optional lookup strategy. */

export type BankIdentifierLookupKind = "ifsc" | "aba" | "none";

export interface BankIdentifierCountryConfig {
  fieldLabel: string;
  placeholder: string;
  hint: string;
  lookup: BankIdentifierLookupKind;
  /** Hide Flex bank dropdown; use text field (IFSC/ABA may pre-fill). */
  hideFlexBankPicker: boolean;
  /** Render the code field above bank/branch (vs after account for generic SWIFT). */
  showIdentifierBeforeBankDetails: boolean;
}

const DEFAULT_CONFIG: BankIdentifierCountryConfig = {
  fieldLabel: "SWIFT / BIC",
  placeholder: "e.g. CHASUS33XXX",
  hint: "8–11 character bank identifier (BIC) for international transfers.",
  lookup: "none",
  hideFlexBankPicker: false,
  showIdentifierBeforeBankDetails: false,
};

const BY_ALPHA3 = new Map<string, BankIdentifierCountryConfig>([
  [
    "IND",
    {
      fieldLabel: "IFSC code",
      placeholder: "e.g. HDFC0000001",
      hint: "",
      lookup: "ifsc",
      hideFlexBankPicker: true,
      showIdentifierBeforeBankDetails: true,
    },
  ],
  [
    "USA",
    {
      fieldLabel: "ABA routing number",
      placeholder: "e.g. 021000021",
      hint: "9-digit ABA routing / transit number. Bank details are looked up automatically when valid.",
      lookup: "aba",
      hideFlexBankPicker: true,
      showIdentifierBeforeBankDetails: true,
    },
  ],
  [
    "CAN",
    {
      fieldLabel: "Institution / transit / SWIFT",
      placeholder: "e.g. 003 + transit + SWIFT if applicable",
      hint: "Use your bank’s Canadian institution number, transit number, or SWIFT as required for the transfer.",
      lookup: "none",
      hideFlexBankPicker: false,
      showIdentifierBeforeBankDetails: false,
    },
  ],
  [
    "GBR",
    {
      fieldLabel: "Sort code & BIC (if applicable)",
      placeholder: "e.g. 12-34-56 or BIC",
      hint: "UK: 6-digit sort code (often shown as xx-xx-xx) and/or BIC for international legs.",
      lookup: "none",
      hideFlexBankPicker: false,
      showIdentifierBeforeBankDetails: false,
    },
  ],
  [
    "AUS",
    {
      fieldLabel: "BSB & SWIFT",
      placeholder: "e.g. 062-000 or BIC",
      hint: "Australian BSB (6 digits) and SWIFT/BIC if your bank requires it.",
      lookup: "none",
      hideFlexBankPicker: false,
      showIdentifierBeforeBankDetails: false,
    },
  ],
]);

export function resolveBankIdentifierConfig(
  couCode: string | undefined | null,
): BankIdentifierCountryConfig {
  const u = couCode?.trim().toUpperCase();
  if (!u) return DEFAULT_CONFIG;
  return BY_ALPHA3.get(u) ?? DEFAULT_CONFIG;
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeIfsc(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase().slice(0, 11);
}

export function normalizeAba(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 9);
}

export function validateBankIdentifier(
  raw: string,
  lookup: BankIdentifierLookupKind,
): string | undefined {
  const t = raw.trim();
  if (!t) return "This field is required";

  if (lookup === "ifsc") {
    const c = normalizeIfsc(t);
    if (!IFSC_RE.test(c)) {
      return "Enter a valid IFSC (4 letters, 0, then 6 alphanumeric).";
    }
    return undefined;
  }

  if (lookup === "aba") {
    const d = normalizeAba(t);
    if (d.length !== 9) {
      return "Enter a valid 9-digit ABA routing number.";
    }
    return undefined;
  }

  if (t.length < 8) {
    return "Enter a valid code (typically 8–11 characters for SWIFT/BIC).";
  }
  return undefined;
}

export type IfscLookupResult = {
  bank: string;
  branch: string;
  swift?: string;
};

export type AbaLookupResult = {
  bank: string;
  city: string;
  state: string;
};
