import type { FlexCountry } from "@/types/flex-country";
import catalogRaw from "@/data/catalog-country-list.json";
import countriesIso from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";
import { fetchCatalogCountries as fetchCatalogCountriesFromApi } from "@/lib/flex-api";

countriesIso.registerLocale(enCountries);

let cachedFallback: FlexCountry[] | null = null;

function normalizeRow(r: unknown): FlexCountry | null {
  if (!r || typeof r !== "object") return null;
  const o = r as { couCode?: unknown; couName?: unknown };
  const couCode = String(o.couCode ?? "").trim().toUpperCase();
  const couName = String(o.couName ?? "").trim();
  if (!couCode || !couName) return null;
  return { couCode, couName };
}

/**
 * Bundled fallback (`catalog-country-list.json`). Use for offline/build sync only.
 * Runtime reads should use {@link fetchCatalogCountries}.
 */
export function getCatalogCountries(): FlexCountry[] {
  if (cachedFallback) return cachedFallback;
  const arr = Array.isArray(catalogRaw) ? catalogRaw : [];
  const rows = arr
    .map(normalizeRow)
    .filter((x): x is FlexCountry => x !== null);
  cachedFallback = [...rows].sort((a, b) => a.couName.localeCompare(b.couName));
  return cachedFallback;
}

/** Load platform catalog from API (admin-managed). Returns empty list when none enabled. */
export async function fetchCatalogCountries(): Promise<FlexCountry[]> {
  try {
    return await fetchCatalogCountriesFromApi();
  } catch {
    return getCatalogCountries();
  }
}

/**
 * Match a user/API country label to a row so flags and dial codes resolve even when
 * spelling differs slightly from our catalog (or the value is an alpha-3 code).
 */
export function matchFlexCountryByLabel(
  countries: FlexCountry[],
  label: string,
): FlexCountry | undefined {
  const t = label.trim();
  if (!t || countries.length === 0) return undefined;
  const lower = t.toLowerCase();

  const exact = countries.find(
    (c) => c.couName.trim().toLowerCase() === lower,
  );
  if (exact) return exact;

  const u = t.toUpperCase();
  if (u.length === 3 && /^[A-Z]{3}$/.test(u)) {
    const byCode = countries.find((c) => c.couCode.toUpperCase() === u);
    if (byCode) return byCode;
  }

  try {
    const a2 = countriesIso.getAlpha2Code(t, "en");
    if (typeof a2 === "string" && a2.length === 2) {
      const a3 = countriesIso.alpha2ToAlpha3(a2);
      if (a3) {
        const byA3 = countries.find(
          (c) => c.couCode.toUpperCase() === a3.toUpperCase(),
        );
        if (byA3) return byA3;
      }
    }
  } catch {
    /* ignore */
  }

  return undefined;
}
