import type { AuthUser } from "@/store/auth.store";

const KYC_STATUS_RANK: Record<AuthUser["kycStatus"], number> = {
  PENDING: 0,
  REJECTED: 1,
  SUBMITTED: 2,
  APPROVED: 3,
  SUSPENDED: 1,
};

/** Avoid stale `/auth/me` downgrading a fresher server-rendered KYC status. */
export function mergeAuthUser(
  previous: AuthUser | null,
  next: AuthUser,
): AuthUser {
  if (!previous || previous.id !== next.id) return next;
  const prevRank = KYC_STATUS_RANK[previous.kycStatus] ?? 0;
  const nextRank = KYC_STATUS_RANK[next.kycStatus] ?? 0;
  if (nextRank < prevRank) {
    return { ...next, kycStatus: previous.kycStatus };
  }
  return next;
}

export function authUserFromAppRow(row: {
  id: string;
  email: string | null;
  name: string | null;
  phone?: string | null;
  role: string;
  kycStatus: string;
  createdAt: Date | string;
}): AuthUser {
  const createdAt =
    typeof row.createdAt === "string"
      ? row.createdAt
      : row.createdAt.toISOString();

  return {
    id: row.id,
    email: row.email,
    phone: row.phone ?? null,
    name: row.name,
    role: (row.role as AuthUser["role"]) || "INDIVIDUAL",
    kycStatus: (row.kycStatus as AuthUser["kycStatus"]) || "PENDING",
    createdAt,
  };
}
