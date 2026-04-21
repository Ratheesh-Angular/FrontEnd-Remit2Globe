/** Display name for API beneficiary rows (first + last). */
export function formatBeneficiaryName(b: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const parts = [b.firstName?.trim(), b.lastName?.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

/** Mask account / IBAN for list cards — last 4 only. */
export function maskAccountLast4(account?: string | null): string {
  const s = String(account ?? "").replace(/\s/g, "");
  if (!s) return "—";
  if (s.length <= 4) return `····${s}`;
  return `····${s.slice(-4)}`;
}

/** Mask phone for list cards — last 4 digits. */
export function maskPhoneLast4(phone?: string | null): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (!d) return "—";
  if (d.length <= 4) return `····${d}`;
  return `····${d.slice(-4)}`;
}

export function beneficiaryInitials(b: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const f = b.firstName?.trim()?.[0];
  const l = b.lastName?.trim()?.[0];
  const s = `${f ?? ""}${l ?? ""}`.toUpperCase();
  return s || "?";
}
