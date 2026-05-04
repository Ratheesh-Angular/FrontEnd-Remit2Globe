/**
 * Hardened server-side fetch for Express API calls from Route Handlers (BFF, sync-session, RSC).
 * - `cache: "no-store"`
 * - One retry after a short delay to survive cold starts / transient TCP failures on cloud hosts
 */
export async function backendOutboundFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const merged: RequestInit = {
    ...init,
    cache: "no-store",
  };

  try {
    return await fetch(input, merged);
  } catch (first) {
    await new Promise((r) => setTimeout(r, 400));
    return fetch(input, merged);
  }
}
