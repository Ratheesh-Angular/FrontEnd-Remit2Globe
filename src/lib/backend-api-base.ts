/**
 * Express mounts routes under `/api`. `NEXT_PUBLIC_API_URL` should be that root
 * (e.g. `https://remit2globe-api.onrender.com/api`). If only the host origin is set,
 * we append `/api` so paths like `/api/flex/countries` resolve correctly.
 */
function normalizeApiBase(rawInput: string): string {
  const raw = rawInput.trim();
  const base = raw.replace(/\/+$/, "");
  if (base.toLowerCase().endsWith("/api")) return base;
  return `${base}/api`;
}

function pickBackendEnvRaw(): string {
  return (
    process.env.BACKEND_INTERNAL_API_URL?.trim() ||
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    ""
  );
}

/** Browser + inlined `NEXT_PUBLIC_*` — login/register and direct client→API calls. */
export function getBackendApiBase(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
  ).trim();
  return normalizeApiBase(raw);
}

export type BackendFetchResolution =
  | { ok: true; baseUrl: string }
  | {
      ok: false;
      reason:
        | "MISSING_BACKEND_URL_PROD"
        | "INVALID_URL"
        | "BACKEND_POINTS_AT_THIS_WEB_SERVICE";
    };

export function backendFetchResolutionMessage(
  res: Extract<BackendFetchResolution, { ok: false }>,
): string {
  switch (res.reason) {
    case "MISSING_BACKEND_URL_PROD":
      return (
        "This server has no backend API URL configured. Set BACKEND_INTERNAL_API_URL (recommended on Render) " +
        "or BACKEND_API_URL to your Express `/api` root, then redeploy."
      );
    case "BACKEND_POINTS_AT_THIS_WEB_SERVICE":
      return (
        "BACKEND_* / NEXT_PUBLIC_API_URL points at this Next.js host. Set it to your separate API service URL " +
        "(Render internal URL + `/api`, or the public `https://…/api` URL)."
      );
    case "INVALID_URL":
      return "BACKEND_INTERNAL_API_URL / BACKEND_API_URL / NEXT_PUBLIC_API_URL is not a valid http(s) URL.";
    default:
      return "Could not resolve backend API base URL.";
  }
}

/**
 * Resolves the Express API base for **server-side** fetches (BFF, sync-session, RSC).
 * On production, refuses the default `localhost` fallback so misconfiguration surfaces as 503, not 502.
 * Prefer `BACKEND_INTERNAL_API_URL` on Render private network (see docs/ENVIRONMENT.md).
 */
export function resolveBackendFetchBase(): BackendFetchResolution {
  const raw = pickBackendEnvRaw();
  const isProd = process.env.NODE_ENV === "production";

  if (!raw && isProd) {
    return { ok: false, reason: "MISSING_BACKEND_URL_PROD" };
  }

  let baseUrl: string;
  try {
    baseUrl = normalizeApiBase(raw || "http://localhost:8000/api");
    const u = new URL(baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "INVALID_URL" };
    }
  } catch {
    return { ok: false, reason: "INVALID_URL" };
  }

  if (!isProd) {
    return { ok: true, baseUrl };
  }

  /** Avoid proxying `/api/backend/*` to this same Next host (`NEXT_PUBLIC_API_URL` typo). */
  const webHints = [
    process.env.RENDER_EXTERNAL_URL?.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    process.env.NEXTAUTH_URL?.trim(),
  ].filter(Boolean) as string[];

  let apiHostname: string;
  try {
    apiHostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return { ok: false, reason: "INVALID_URL" };
  }

  for (const hint of webHints) {
    try {
      const webUrl =
        hint.startsWith("http://") || hint.startsWith("https://")
          ? hint
          : `https://${hint}`;
      const webHost = new URL(webUrl).hostname.toLowerCase();
      if (webHost && webHost === apiHostname) {
        return { ok: false, reason: "BACKEND_POINTS_AT_THIS_WEB_SERVICE" };
      }
    } catch {
      /* ignore invalid hint */
    }
  }

  return { ok: true, baseUrl };
}

/**
 * Route Handlers / RSC server fetch — prefers internal then `BACKEND_API_URL` then `NEXT_PUBLIC_API_URL`.
 * In production, still returns a string for legacy callers; prefer `resolveBackendFetchBase` in BFF routes.
 */
export function getBackendApiBaseServer(): string {
  const r = resolveBackendFetchBase();
  if (r.ok) return r.baseUrl;
  console.error(
    "[backend-api-base] resolveBackendFetchBase failed:",
    r.reason,
    "— set BACKEND_INTERNAL_API_URL or BACKEND_API_URL on the web service.",
  );
  return normalizeApiBase("http://localhost:8000/api");
}

/** Upstream cold starts / TLS handshakes (e.g. Render free tier). */
export const BACKEND_FETCH_TIMEOUT_MS = 60_000;
