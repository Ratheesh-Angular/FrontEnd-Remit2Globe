import type { FlexCountry } from "@/types/flex-country";
import catalogRaw from "@/data/catalog-country-list.json";
import countriesIso from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";
import { fetchCatalogCountries as fetchCatalogCountriesFromApi } from "@/lib/flex-api";

countriesIso.registerLocale(enCountries);

let cachedFallbackUnion: FlexCountry[] | null = null;
const cachedFallbackByOp = new Map<string, FlexCountry[]>();

function normalizeRow(r: unknown): FlexCountry | null {
  if (!r || typeof r !== "object") return null;
  const o = r as { couCode?: unknown; couName?: unknown };
  const couCode = String(o.couCode ?? "").trim().toUpperCase();
  const couName = String(o.couName ?? "").trim();
  if (!couCode || !couName) return null;
  return { couCode, couName };
}

function nameForAlpha3(code: string): string {
  try {
    const a2 = countriesIso.alpha3ToAlpha2(code);
    if (a2) {
      const name = countriesIso.getName(a2, "en");
      if (name) return name;
    }
  } catch {
    /* ignore */
  }
  return code;
}

function rowsFromCodes(codes: string[]): FlexCountry[] {
  const seen = new Set<string>();
  const rows: FlexCountry[] = [];
  for (const raw of codes) {
    const couCode = String(raw ?? "").trim().toUpperCase();
    if (!couCode || seen.has(couCode)) continue;
    seen.add(couCode);
    rows.push({ couCode, couName: nameForAlpha3(couCode) });
  }
  return rows.sort((a, b) => a.couName.localeCompare(b.couName));
}

function parseBundledCatalog(): {
  union: FlexCountry[];
  byOp: Record<string, FlexCountry[]>;
} {
  const byOp: Record<string, FlexCountry[]> = {};
  if (Array.isArray(catalogRaw)) {
    const union = catalogRaw
      .map(normalizeRow)
      .filter((x): x is FlexCountry => x !== null)
      .sort((a, b) => a.couName.localeCompare(b.couName));
    return { union, byOp };
  }
  const map =
    catalogRaw &&
    typeof catalogRaw === "object" &&
    "byOperationCountry" in catalogRaw
      ? (catalogRaw as { byOperationCountry?: Record<string, unknown> })
          .byOperationCountry
      : null;
  if (!map || typeof map !== "object") {
    return { union: [], byOp };
  }
  const allCodes = new Set<string>();
  for (const [op, list] of Object.entries(map)) {
    const opCode = op.trim().toUpperCase();
    const codes = Array.isArray(list)
      ? list.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
      : [];
    byOp[opCode] = rowsFromCodes(codes);
    for (const c of codes) allCodes.add(c);
  }
  return { union: rowsFromCodes([...allCodes]), byOp };
}

/** ISO2 (or ISO3) → ISO3 alpha. */
export function toCountryAlpha3(code: string | null | undefined): string {
  const t = String(code ?? "").trim().toUpperCase();
  if (!t) return "";
  if (/^[A-Z]{3}$/.test(t)) return t;
  if (/^[A-Z]{2}$/.test(t)) {
    try {
      const a3 = countriesIso.alpha2ToAlpha3(t);
      if (typeof a3 === "string" && a3.length === 3) return a3.toUpperCase();
    } catch {
      /* ignore */
    }
  }
  return "";
}

/**
 * Bundled fallback (`catalog-country-list.json`). Use for offline/build sync only.
 * Runtime reads should use {@link fetchCatalogCountries}.
 */
export function getCatalogCountries(countryCode?: string): FlexCountry[] {
  if (!cachedFallbackUnion) {
    const parsed = parseBundledCatalog();
    cachedFallbackUnion = parsed.union;
    for (const [k, v] of Object.entries(parsed.byOp)) {
      cachedFallbackByOp.set(k, v);
    }
  }
  const op = toCountryAlpha3(countryCode);
  if (op) {
    return cachedFallbackByOp.get(op) ?? [];
  }
  return cachedFallbackUnion;
}

/** Load platform catalog from API for an operation country. */
export async function fetchCatalogCountries(
  countryCode?: string,
): Promise<FlexCountry[]> {
  const op = toCountryAlpha3(countryCode);
  try {
    return await fetchCatalogCountriesFromApi(op || undefined);
  } catch {
    return getCatalogCountries(op || undefined);
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
