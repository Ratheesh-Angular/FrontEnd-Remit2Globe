import type { Session } from "next-auth";
import { getSession } from "next-auth/react";
import type { AuthUser } from "@/store/auth.store";

/** NextAuth client fetch can throw on network/5xx; treat as "no session". */
export async function safeGetSession(): Promise<Session | null> {
  try {
    return await getSession();
  } catch (err) {
    console.warn("[safeGetSession]", err);
    return null;
  }
}

/** Normalize `/auth/me` JSON whether axios wraps it or backend nests under `data`. */
export function extractAuthMeUser(payload: unknown): AuthUser | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = root.data;
  let raw: unknown;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    raw = d.user ?? d;
  } else {
    raw = root.user;
  }
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const id = u.id;
  if (typeof id !== "string" || id.length === 0) return null;

  const email =
    u.email === null || u.email === undefined
      ? null
      : String(u.email);
  const phone =
    u.phone === null || u.phone === undefined
      ? null
      : String(u.phone);

  const createdAt =
    typeof u.createdAt === "string"
      ? u.createdAt
      : u.createdAt instanceof Date
        ? u.createdAt.toISOString()
        : new Date().toISOString();

  return {
    id,
    email,
    phone,
    role: (u.role as AuthUser["role"]) || "INDIVIDUAL",
    kycStatus: (u.kycStatus as AuthUser["kycStatus"]) || "PENDING",
    createdAt,
  };
}

/**
 * Works even when multiple axios copies break `axios.isAxiosError` identity checks.
 */
export function getHttpErrorStatus(e: unknown): number | undefined {
  if (!e || typeof e !== "object") return undefined;
  const res = (e as { response?: { status?: unknown } }).response;
  const status = res?.status;
  return typeof status === "number" ? status : undefined;
}

export function getErrorMessage(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  const m = (e as { message?: unknown }).message;
  return typeof m === "string" ? m : undefined;
}
