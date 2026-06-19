import type { Country } from "@/lib/phone-countries";
import { ALL_COUNTRIES } from "@/lib/phone-countries";
import countriesIso from "i18n-iso-countries";
import {
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

function resolveAlpha2(couCode: string): string | null {
  const u = couCode.trim().toUpperCase();
  if (!u) return null;
  if (u.length === 2 && /^[A-Z]{2}$/.test(u)) return u;
  const fromAlpha3 = countriesIso.alpha3ToAlpha2(u);
  return fromAlpha3 ?? null;
}

function fallbackPhoneCountry(alpha2: string): Country | null {
  try {
    const dialCode = String(getCountryCallingCode(alpha2 as CountryCode));
    const name = countriesIso.getName(alpha2, "en") ?? alpha2;
    return {
      code: alpha2,
      name,
      dialCode,
      minDigits: 7,
      maxDigits: 15,
    };
  } catch {
    return null;
  }
}

/**
 * Map a Flex/catalog alpha-3 (or alpha-2) code to a {@link Country} row for dial-code validation.
 */
export function phoneCountryFromCouCode(couCode: string): Country | null {
  const alpha2 = resolveAlpha2(couCode);
  if (!alpha2) return null;
  return (
    ALL_COUNTRIES.find((c) => c.code === alpha2) ??
    fallbackPhoneCountry(alpha2)
  );
}
