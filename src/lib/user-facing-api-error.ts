function isInternalLeak(text: string): boolean {
  const m = text.toLowerCase();
  return (
    m.includes("prisma") ||
    m.includes("invalid `prisma") ||
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("does not exist in the current database")
  );
}

function rawApiMessage(error: unknown): string {
  if (typeof error === "string") return error.trim();
  const raw =
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message;
  return String(raw ?? "").trim();
}

/**
 * Strip internal API details from axios-style errors for UI copy (dialogs, banners).
 */
export function userFacingApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const msg = rawApiMessage(error);
  const check = msg || fallback;
  if (isInternalLeak(check)) {
    return fallback;
  }
  return msg || fallback;
}

/** Sanitize an error string already extracted from the API (e.g. modal submit handlers). */
export function userFacingApiMessageText(text: unknown, fallback: string): string {
  const msg = String(text ?? "").trim();
  const check = msg || fallback;
  if (isInternalLeak(check)) {
    return fallback;
  }
  return msg || fallback;
}
