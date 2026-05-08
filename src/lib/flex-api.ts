import type { FlexCountry } from "@/types/flex-country";
import { getBackendApiBase, getBackendApiBaseServer } from "@/lib/backend-api-base";
import { isPublicFlexBrowserPath } from "@/lib/flex-public-paths";

function nextPublicApiPointsAtLocalhost(): boolean {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").trim();
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(raw);
}

/**
 * Base URL for backend `/api/flex/*` (token, countries, banks, etc.).
 *
 * Browser + public paths (`/countries`, `/banks/…`):
 * - If `NEXT_PUBLIC_API_URL` is localhost (typical dev / missing prod embed), use same-origin
 *   `GET /api/public-flex/*` so the server can apply `BACKEND_*_URL`.
 * - Otherwise call the API host embedded at build time (production EC2 builds should set
 *   `NEXT_PUBLIC_API_URL` to the real `/api` root so this works even before the proxy route is deployed).
 */
export function flexApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (
    typeof window !== "undefined" &&
    isPublicFlexBrowserPath(p) &&
    nextPublicApiPointsAtLocalhost()
  ) {
    return `/api/public-flex${p}`;
  }
  const base =
    typeof window === "undefined"
      ? getBackendApiBaseServer()
      : getBackendApiBase();
  const root = base.replace(/\/+$/, "");
  return `${root}/flex${p}`;
}

/** Match backend `extractCountryRows` on the raw Flex country payload. */
function extractCountryRows(flexJson: unknown): { couCode?: string; couName?: string }[] {
  if (!flexJson || typeof flexJson !== "object") return [];
  const d = flexJson as Record<string, unknown>;
  const inner = d.data;
  if (inner && typeof inner === "object" && "data" in inner) {
    const arr = (inner as { data?: unknown }).data;
    if (Array.isArray(arr)) {
      return arr as { couCode?: string; couName?: string }[];
    }
  }
  if (Array.isArray((d as { data?: unknown }).data)) {
    return (d as { data: { couCode?: string; couName?: string }[] }).data;
  }
  return [];
}

/**
 * Parse `GET /api/flex/countries` JSON (`{ success, data }` or raw inner payload)
 * into normalized country rows.
 */
export function parseFlexCountriesResponse(json: unknown): FlexCountry[] {
  const body =
    json &&
    typeof json === "object" &&
    "data" in (json as object) &&
    (json as { data?: unknown }).data !== undefined
      ? (json as { data: unknown }).data
      : json;
  return extractCountryRows(body)
    .map((r) => ({
      couCode: String(r.couCode ?? "").trim().toUpperCase(),
      couName: String(r.couName ?? "").trim(),
    }))
    .filter((c) => c.couCode.length > 0 && c.couName.length > 0)
    .sort((a, b) => a.couName.localeCompare(b.couName));
}

export async function fetchFlexCountries(): Promise<FlexCountry[]> {
  const res = await fetch(flexApiUrl("/countries"), { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load countries: ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseFlexCountriesResponse(json);
}
