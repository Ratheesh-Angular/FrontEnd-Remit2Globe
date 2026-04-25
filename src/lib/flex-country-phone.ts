import type { Country } from "@/lib/phone-countries";
import { ALL_COUNTRIES } from "@/lib/phone-countries";
import countriesIso from "i18n-iso-countries";

/**
 * Map a Flex alpha-3 code to a {@link Country} row for dial-code validation
 * when that alpha-2 exists in {@link ALL_COUNTRIES}.
 */
export function phoneCountryFromCouCode(
  couCode: string,
): Country | null {
  const u = couCode?.trim().toUpperCase();
  if (!u) return null;
  const a2 = countriesIso.alpha3ToAlpha2(u);
  if (!a2) return null;
  return ALL_COUNTRIES.find((c) => c.code === a2) ?? null;
}
