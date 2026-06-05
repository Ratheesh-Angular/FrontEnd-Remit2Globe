/** Multi-field bank identifier configuration driven by payout currency. */

export type BankFieldKey =
  | "iban"
  | "swiftBic"
  | "sortCode"
  | "routingNumber"
  | "transitNumber"
  | "bsb"
  | "ifsc"
  | "accountNumber";

export interface BankField {
  key: BankFieldKey;
  label: string;
  placeholder: string;
  hint: string;
  required: boolean;
  /** Normalisation/validation strategy */
  lookup: "ifsc" | "aba" | "iban" | "none";
  maxLength?: number;
}

export interface BankIdentifierConfig {
  fields: BankField[];
  /** Show identifier fields before bank name / account fields */
  showIdentifiersFirst: boolean;
  /** Hide the Flex bank dropdown in favour of manual entry */
  hideFlexBankPicker: boolean;
}

// ─── Reusable field descriptors ──────────────────────────────────────────────

const FIELD_IBAN: BankField = {
  key: "iban",
  label: "IBAN",
  placeholder: "e.g. GB29NWBK60161331926819",
  hint: "International Bank Account Number",
  required: true,
  lookup: "iban",
};

const FIELD_SWIFT_REQUIRED: BankField = {
  key: "swiftBic",
  label: "SWIFT / BIC",
  placeholder: "e.g. CHASUS33XXX",
  hint: "8–11 character SWIFT/BIC code",
  required: true,
  lookup: "none",
  maxLength: 11,
};

const FIELD_SWIFT_OPTIONAL: BankField = {
  ...FIELD_SWIFT_REQUIRED,
  required: false,
  hint: "Optional – include for faster processing",
};

const FIELD_SORT_CODE: BankField = {
  key: "sortCode",
  label: "Sort Code",
  placeholder: "e.g. 12-34-56",
  hint: "6-digit UK sort code",
  required: true,
  lookup: "none",
  maxLength: 8,
};

const FIELD_ROUTING: BankField = {
  key: "routingNumber",
  label: "ABA Routing Number",
  placeholder: "e.g. 021000021",
  hint: "9-digit ABA routing number",
  required: true,
  lookup: "aba",
  maxLength: 9,
};

const FIELD_TRANSIT: BankField = {
  key: "transitNumber",
  label: "Transit Number",
  placeholder: "e.g. 00102-003",
  hint: "Canadian institution + transit number",
  required: true,
  lookup: "none",
};

const FIELD_BSB: BankField = {
  key: "bsb",
  label: "BSB Code",
  placeholder: "e.g. 062-000",
  hint: "6-digit Australian BSB code",
  required: true,
  lookup: "none",
  maxLength: 7,
};

const FIELD_IFSC: BankField = {
  key: "ifsc",
  label: "IFSC Code",
  placeholder: "e.g. HDFC0000001",
  hint: "11-character Indian IFSC code",
  required: true,
  lookup: "ifsc",
  maxLength: 11,
};

const FIELD_ACCOUNT: BankField = {
  key: "accountNumber",
  label: "Account Number",
  placeholder: "e.g. 0123456789",
  hint: "",
  required: true,
  lookup: "none",
};

// ─── Shared IBAN + SWIFT (required) config ───────────────────────────────────

const IBAN_SWIFT_REQUIRED: BankIdentifierConfig = {
  fields: [FIELD_IBAN, FIELD_SWIFT_REQUIRED],
  showIdentifiersFirst: false,
  hideFlexBankPicker: false,
};

// ─── Currency-first lookup map ───────────────────────────────────────────────

const BY_CURRENCY = new Map<string, BankIdentifierConfig>([
  ["EUR", IBAN_SWIFT_REQUIRED],
  [
    "GBP",
    {
      fields: [FIELD_IBAN, FIELD_SORT_CODE, FIELD_SWIFT_OPTIONAL],
      showIdentifiersFirst: false,
      hideFlexBankPicker: false,
    },
  ],
  [
    "USD",
    {
      fields: [FIELD_ROUTING, FIELD_SWIFT_OPTIONAL, FIELD_ACCOUNT],
      showIdentifiersFirst: true,
      hideFlexBankPicker: true,
    },
  ],
  [
    "CAD",
    {
      fields: [FIELD_ACCOUNT, FIELD_TRANSIT, FIELD_SWIFT_OPTIONAL],
      showIdentifiersFirst: false,
      hideFlexBankPicker: false,
    },
  ],
  [
    "AUD",
    {
      fields: [FIELD_ACCOUNT, FIELD_BSB, FIELD_SWIFT_OPTIONAL],
      showIdentifiersFirst: false,
      hideFlexBankPicker: false,
    },
  ],
  [
    "NZD",
    {
      fields: [FIELD_ACCOUNT, FIELD_SWIFT_REQUIRED],
      showIdentifiersFirst: false,
      hideFlexBankPicker: false,
    },
  ],
  ["AED", IBAN_SWIFT_REQUIRED],
  [
    "INR",
    {
      fields: [FIELD_IFSC, FIELD_ACCOUNT],
      showIdentifiersFirst: true,
      hideFlexBankPicker: true,
    },
  ],
  [
    "PKR",
    {
      fields: [FIELD_IBAN, FIELD_SWIFT_OPTIONAL],
      showIdentifiersFirst: false,
      hideFlexBankPicker: false,
    },
  ],
]);

// Currencies using Account Number + SWIFT (optional)
for (const cur of [
  "BDT", "PHP", "VND", "NPR", "MYR", "SGD",
  "KES", "UGX", "TZS", "NGN", "GHS",
]) {
  BY_CURRENCY.set(cur, {
    fields: [FIELD_ACCOUNT, FIELD_SWIFT_OPTIONAL],
    showIdentifiersFirst: false,
    hideFlexBankPicker: false,
  });
}

// Currencies using IBAN + SWIFT (required)
for (const cur of [
  "XOF", "XAF", "TRY", "SAR", "QAR", "BHD",
  "JOD", "KWD", "LBP", "EGP", "TND",
]) {
  BY_CURRENCY.set(cur, IBAN_SWIFT_REQUIRED);
}

// ─── SEPA / European countries (fallback when currency not matched) ───────────

/** European countries that use IBAN (ISO 3166-1 alpha-3 codes) */
export const EUROPEAN_COUNTRIES = new Set([
  "ALB", "AND", "AUT", "BLR", "BEL", "BIH", "BGR", "HRV", "CYP", "CZE",
  "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "ISL", "IRL", "ITA",
  "LVA", "LIE", "LTU", "LUX", "MLT", "MDA", "MCO", "MNE", "NLD", "MKD",
  "NOR", "POL", "PRT", "ROU", "RUS", "SMR", "SRB", "SVK", "SVN", "ESP",
  "SWE", "CHE", "UKR", "VAT",
]);

// ─── Default fallback ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BankIdentifierConfig = {
  fields: [FIELD_ACCOUNT, FIELD_SWIFT_REQUIRED],
  showIdentifiersFirst: false,
  hideFlexBankPicker: false,
};

// ─── Main resolver ────────────────────────────────────────────────────────────

export function resolveBankIdentifierConfig(
  currency: string,
  couCode?: string | null,
): BankIdentifierConfig {
  const cur = currency?.trim().toUpperCase();
  if (cur) {
    const byCurrency = BY_CURRENCY.get(cur);
    if (byCurrency) return byCurrency;
  }

  const u = couCode?.trim().toUpperCase();
  if (u && EUROPEAN_COUNTRIES.has(u)) return IBAN_SWIFT_REQUIRED;

  return DEFAULT_CONFIG;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeIfsc(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase().slice(0, 11);
}

export function normalizeAba(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 9);
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

export function normalizeSortCode(raw: string): string {
  return raw.replace(/[^\d-]/g, "").slice(0, 8);
}

export function normalizeBsb(raw: string): string {
  return raw.replace(/[^\d-]/g, "").slice(0, 7);
}

// ─── IBAN length by country (ISO 3166-1 alpha-2) ─────────────────────────────

const IBAN_LENGTH_BY_COUNTRY: Readonly<Record<string, number>> = {
  AE: 23, AT: 20, BE: 16, BF: 28, BG: 22, BH: 22, BJ: 28, CF: 27,
  CG: 27, CH: 21, CI: 28, CM: 27, CZ: 24, DE: 22, DK: 18, EE: 20,
  EG: 29, ES: 24, FI: 18, FR: 27, GA: 27, GB: 22, GQ: 27, GW: 25,
  HR: 21, HU: 28, IE: 22, IT: 27, JO: 30, KW: 30, LB: 28, LT: 20,
  LU: 20, LV: 21, ML: 28, NE: 28, NL: 18, NO: 15, PK: 24, PL: 28,
  PT: 25, QA: 29, RO: 24, SA: 24, SE: 24, SI: 19, SK: 24, SN: 28,
  TD: 27, TG: 28, TR: 26,
};

// ─── Per-field validator ──────────────────────────────────────────────────────

export function validateBankField(
  field: BankField,
  value: string,
): string | undefined {
  const t = value.trim();

  if (!t) {
    return field.required ? `${field.label} is required` : undefined;
  }

  if (field.lookup === "ifsc") {
    if (!IFSC_RE.test(normalizeIfsc(t))) {
      return "Enter a valid IFSC (4 letters, 0, then 6 alphanumeric).";
    }
    return undefined;
  }

  if (field.lookup === "aba") {
    if (normalizeAba(t).length !== 9) {
      return "Enter a valid 9-digit ABA routing number.";
    }
    return undefined;
  }

  if (field.lookup === "iban") {
    const i = normalizeIban(t);
    const countryCode = i.slice(0, 2).toUpperCase();
    const expectedLen = IBAN_LENGTH_BY_COUNTRY[countryCode];
    if (expectedLen !== undefined) {
      if (i.length !== expectedLen) {
        return `IBAN for ${countryCode} must be exactly ${expectedLen} characters (entered ${i.length}).`;
      }
    } else {
      if (i.length < 15 || i.length > 34) {
        return "Enter a valid IBAN (15–34 characters).";
      }
    }
    return undefined;
  }

  if (field.key === "sortCode") {
    if (t.replace(/\D/g, "").length !== 6) {
      return "Enter a valid 6-digit sort code.";
    }
    return undefined;
  }

  if (field.key === "bsb") {
    if (t.replace(/\D/g, "").length !== 6) {
      return "Enter a valid 6-digit BSB code.";
    }
    return undefined;
  }

  if (field.key === "transitNumber") {
    const d = t.replace(/\D/g, "").length;
    if (d < 8 || d > 9) {
      return "Enter a valid Canadian transit number (8–9 digits).";
    }
    return undefined;
  }

  if (field.key === "swiftBic") {
    const clean = t.replace(/\s/g, "").toUpperCase();
    if (clean.length < 8 || clean.length > 11 || !/^[A-Z0-9]+$/.test(clean)) {
      return "Enter a valid SWIFT/BIC (8–11 alphanumeric characters).";
    }
    return undefined;
  }

  return undefined;
}

// ─── Legacy type exports ──────────────────────────────────────────────────────

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
