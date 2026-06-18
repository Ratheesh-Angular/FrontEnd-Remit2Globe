import rulesRaw from "@/data/passport-validation-rules.json";
import {
  getCatalogCountries,
  matchFlexCountryByLabel,
} from "@/lib/catalog-countries";
import type { FlexCountry } from "@/types/flex-country";

export type PassportValidationRule = {
  minLength: number;
  maxLength: number;
  digitsOnly?: boolean;
  pattern?: string;
  hint?: string;
};

const RULES = rulesRaw as Record<string, PassportValidationRule>;

export function getPassportRuleByCountryCode(
  couCode: string,
): PassportValidationRule | undefined {
  const code = couCode.trim().toUpperCase();
  return RULES[code];
}

export function getPassportRuleForIssuingCountry(
  issuingCountryLabel: string,
  countries: FlexCountry[] = getCatalogCountries(),
): PassportValidationRule | undefined {
  const label = issuingCountryLabel.trim();
  if (!label) return undefined;
  const row = matchFlexCountryByLabel(countries, label);
  if (!row) return undefined;
  return getPassportRuleByCountryCode(row.couCode);
}

/** Strip spaces/hyphens, enforce charset, and cap at max length for the country. */
export function sanitizePassportNumber(
  raw: string,
  rule?: PassportValidationRule,
): string {
  let value = raw.replace(/[\s-]/g, "").toUpperCase();
  if (rule?.digitsOnly) {
    value = value.replace(/\D/g, "");
  } else {
    value = value.replace(/[^A-Z0-9]/g, "");
  }
  if (rule?.maxLength) {
    value = value.slice(0, rule.maxLength);
  }
  return value;
}

export function passportFormatHint(
  rule: PassportValidationRule | undefined,
  countryName?: string,
): string | undefined {
  if (!rule?.hint) return undefined;
  const prefix = countryName?.trim() ? `${countryName}: ` : "";
  return `${prefix}${rule.hint}`;
}

/**
 * Returns an error message when invalid, or null when valid / not yet checkable.
 * Pass `allowEmpty: true` while the user is still typing (skips required check).
 */
export function validatePassportNumber(
  issuingCountryLabel: string,
  passportNumber: string,
  options?: {
    countries?: FlexCountry[];
    /** Skip required check (e.g. while field is empty during typing). */
    allowEmpty?: boolean;
    /** While typing, only flag over-max or invalid chars — not under-min length. */
    allowIncomplete?: boolean;
  },
): string | null {
  const trimmed = passportNumber.trim();
  if (!trimmed) {
    return options?.allowEmpty ? null : "Passport number is required";
  }

  const rule = getPassportRuleForIssuingCountry(
    issuingCountryLabel,
    options?.countries,
  );
  if (!rule) return null;

  const normalized = sanitizePassportNumber(trimmed, rule);
  const { minLength, maxLength } = rule;

  if (normalized.length > maxLength) {
    return `Passport number must not exceed ${maxLength} characters for this country.`;
  }

  if (rule.digitsOnly && normalized.length > 0 && !/^\d+$/.test(normalized)) {
    return `Passport number must contain digits only (${rule.hint ?? `${minLength}–${maxLength} digits`}).`;
  }

  if (
    !rule.digitsOnly &&
    normalized.length > 0 &&
    !/^[A-Z0-9]+$/.test(normalized)
  ) {
    return "Passport number must be alphanumeric.";
  }

  if (options?.allowIncomplete && normalized.length < minLength) {
    return null;
  }

  if (normalized.length < minLength) {
    return minLength === maxLength
      ? `Passport number must be exactly ${maxLength} characters for this country.`
      : `Passport number must be ${minLength}–${maxLength} characters for this country.`;
  }

  if (rule.pattern) {
    const re = new RegExp(rule.pattern);
    if (!re.test(normalized)) {
      return rule.hint
        ? `Invalid passport format. Expected: ${rule.hint}.`
        : "Passport number format is invalid for the selected country.";
    }
  }

  return null;
}
