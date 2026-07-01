import { cookies, headers } from "next/headers";
import { loadAppUser } from "@/lib/auth";
import { authUserFromAppRow } from "@/lib/auth-user";
import { resolveBackendFetchBase } from "@/lib/backend-api-base";
import { backendOutboundFetch } from "@/lib/backend-outbound-fetch";
import type { AuthUser } from "@/store/auth.store";

/** Fresh user row for dashboard shell (sidebar KYC gates) — same sources as dashboard page. */
export async function loadDashboardShellUser(
  sessionUserId: string | undefined,
): Promise<AuthUser | null> {
  const id = sessionUserId?.trim();
  if (id) {
    const row = await loadAppUser(id);
    if (row) return authUserFromAppRow(row);
  }

  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  if (!cookieHeader.includes("token=")) return null;

  const resolved = resolveBackendFetchBase();
  if (!resolved.ok) return null;

  const base = resolved.baseUrl;
  const res = await backendOutboundFetch(`${base}/auth/me`, {
    headers: { cookie: cookieHeader },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    data?: {
      user?: {
        id: string;
        email: string | null;
        phone: string | null;
        name?: string | null;
        role: string;
        kycStatus: string;
        createdAt: string;
      };
    };
  };
  const u = body.data?.user;
  if (!u?.id) return null;

  const displayName =
    typeof u.name === "string" && u.name.trim() ? u.name.trim() : null;

  return authUserFromAppRow({
    id: u.id,
    email: u.email,
    phone: u.phone,
    name: displayName,
    role: u.role,
    kycStatus: u.kycStatus,
    createdAt: u.createdAt,
  });
}

export async function hasBackendAuthCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get("token")?.value);
}
