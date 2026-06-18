import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { ALL_COUNTRIES, type Country } from "@/lib/phone-countries";

/** Longest dial-code match first (e.g. +1 vs +123). */
const COUNTRIES_BY_DIAL_DESC = [...ALL_COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length,
);

export function findCountryByIso2(iso2: string): Country | undefined {
  const code = iso2.trim().toUpperCase();
  return ALL_COUNTRIES.find((c) => c.code === code);
}

export function parseE164Phone(
  e164: string,
): { country: Country; national: string } | null {
  const raw = e164.trim();
  if (!raw.startsWith("+")) return null;

  try {
    const pn = parsePhoneNumberFromString(raw);
    const iso = pn?.country;
    if (iso && pn?.nationalNumber != null) {
      const country = findCountryByIso2(iso);
      if (country) {
        return { country, national: String(pn.nationalNumber) };
      }
    }
  } catch {
    /* fall through */
  }

  const digits = raw.slice(1).replace(/\D/g, "");
  for (const country of COUNTRIES_BY_DIAL_DESC) {
    if (digits.startsWith(country.dialCode)) {
      const national = digits.slice(country.dialCode.length);
      if (national.length > 0) {
        return { country, national };
      }
    }
  }

  return null;
}

/** Validate local digits for a selected dial country (register + PhoneCountryInput). */
export function validateNationalPhoneDigits(
  country: Country,
  nationalDigits: string,
): string | null {
  const digits = nationalDigits.replace(/\D/g, "");
  if (!digits) return "Phone number is required.";

  const { minDigits, maxDigits, name, dialCode } = country;
  if (digits.length < minDigits || digits.length > maxDigits) {
    const dialPart = dialCode ? ` (+${dialCode})` : "";
    return minDigits === maxDigits
      ? `Enter exactly ${minDigits} digits for ${name}${dialPart}.`
      : `Enter ${minDigits}–${maxDigits} digits for ${name}${dialPart}.`;
  }

  return null;
}

/** Validate full E.164 value using the matched country's digit rules. */
export function validateE164Phone(
  e164: string,
  hintCountry?: Country | null,
): string | null {
  const raw = e164.trim();
  if (!raw) return "Phone number is required.";
  if (!raw.startsWith("+")) {
    return "Include country code (e.g. +254712345678).";
  }

  const parsed = parseE164Phone(raw);
  if (parsed) {
    return validateNationalPhoneDigits(parsed.country, parsed.national);
  }

  if (hintCountry) {
    const digits = raw.slice(1).replace(/\D/g, "");
    const national = digits.startsWith(hintCountry.dialCode)
      ? digits.slice(hintCountry.dialCode.length)
      : digits;
    return validateNationalPhoneDigits(hintCountry, national);
  }

  return "Enter a valid mobile number with country code.";
}

export function isValidE164Phone(
  e164: string,
  hintCountry?: Country | null,
): boolean {
  const raw = e164.trim();
  if (!raw) return false;
  return validateE164Phone(raw, hintCountry) === null;
}

export function nationalPhonePlaceholder(country: Country): string {
  return country.minDigits === country.maxDigits
    ? `${country.minDigits} digits`
    : `${country.minDigits}–${country.maxDigits} digits`;
}
