import type { FlexCountry } from "@/types/flex-country";
import catalogRaw from "@/data/catalog-country-list.json";

let cached: FlexCountry[] | null = null;

function normalizeRow(r: unknown): FlexCountry | null {
  if (!r || typeof r !== "object") return null;
  const o = r as { couCode?: unknown; couName?: unknown };
  const couCode = String(o.couCode ?? "").trim().toUpperCase();
  const couName = String(o.couName ?? "").trim();
  if (!couCode || !couName) return null;
  return { couCode, couName };
}

/**
 * Full catalog (`catalog-country-list.json`, mirrored from backend `countryList.json`).
 * Sorted by display name. Safe to call on client or server.
 */
export function getCatalogCountries(): FlexCountry[] {
  if (cached) return cached;
  const arr = Array.isArray(catalogRaw) ? catalogRaw : [];
  const rows = arr
    .map(normalizeRow)
    .filter((x): x is FlexCountry => x !== null);
  cached = [...rows].sort((a, b) => a.couName.localeCompare(b.couName));
  return cached;
}
