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

/** Browser + inlined `NEXT_PUBLIC_*` — login/register and direct client→API calls. */
export function getBackendApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").trim();
  return normalizeApiBase(raw);
}

/**
 * Route Handlers / RSC server fetch — prefers `BACKEND_API_URL` (runtime on Render, no rebuild)
 * then falls back to `NEXT_PUBLIC_API_URL`. Use for BFF proxy and server-side `/auth/me`.
 */
export function getBackendApiBaseServer(): string {
  const fromEnv =
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "";
  if (fromEnv) return normalizeApiBase(fromEnv);
  return normalizeApiBase("http://localhost:5000/api");
}
