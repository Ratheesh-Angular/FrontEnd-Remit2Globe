/**
 * Express mounts routes under `/api`. `NEXT_PUBLIC_API_URL` should be that root
 * (e.g. `https://remit2globe-api.onrender.com/api`). If only the host origin is set,
 * we append `/api` so paths like `/api/flex/countries` resolve correctly.
 */
export function getBackendApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").trim();
  const base = raw.replace(/\/+$/, "");
  if (base.toLowerCase().endsWith("/api")) return base;
  return `${base}/api`;
}
