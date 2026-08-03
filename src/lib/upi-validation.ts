/**
 * Indian UPI VPA (Virtual Payment Address) validation.
 *
 * Mirrors backend `cbp-backend/src/lib/upi-validation.ts` for instant UI feedback.
 */

export type UpiValidationResult = {
  isValid: boolean;
  error: string | null;
  /** Normalized VPA (trimmed + lowercase) when structurally parseable; else null. */
  normalized?: string | null;
};

/** Major active Indian UPI handles (PSP / bank suffixes). */
export const UPI_HANDLE_WHITELIST = new Set<string>([
  "oksbi",
  "okaxis",
  "okhdfcbank",
  "okicici",
  "ybl",
  "ibl",
  "axl",
  "paytm",
  "upi",
  "centralbank",
  "barodampay",
  "icici",
  "hdfcbank",
  "axisbank",
  "ikwik",
  "kmbl",
]);

const USERNAME_ALLOWED = /^[a-z0-9._-]+$/;
const SPECIAL_CHAR = /[._-]/;
const CONSECUTIVE_SPECIAL = /[._-]{2,}/;

/**
 * Validate an Indian UPI ID (VPA).
 *
 * @returns `{ isValid, error }` — `error` is a clear message for each failure case.
 */
export function validateUpiId(input: unknown): UpiValidationResult {
  if (input == null || typeof input !== "string") {
    return {
      isValid: false,
      error: "UPI ID is required",
      normalized: null,
    };
  }

  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return {
      isValid: false,
      error: "UPI ID is required",
      normalized: null,
    };
  }

  if (normalized.length > 64) {
    return {
      isValid: false,
      error: "UPI ID must not exceed 64 characters",
      normalized,
    };
  }

  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return {
      isValid: false,
      error: "UPI ID must contain exactly one '@' (e.g. name@ybl)",
      normalized,
    };
  }

  const [username, handle] = parts;

  if (!username) {
    return {
      isValid: false,
      error: "UPI username (before '@') is required",
      normalized,
    };
  }

  if (username.length < 2 || username.length > 50) {
    return {
      isValid: false,
      error: "UPI username must be between 2 and 50 characters",
      normalized,
    };
  }

  if (!USERNAME_ALLOWED.test(username)) {
    return {
      isValid: false,
      error:
        "UPI username may only contain letters, numbers, dots, hyphens, or underscores",
      normalized,
    };
  }

  if (
    SPECIAL_CHAR.test(username[0]!) ||
    SPECIAL_CHAR.test(username[username.length - 1]!)
  ) {
    return {
      isValid: false,
      error:
        "UPI username must not start or end with a dot, hyphen, or underscore",
      normalized,
    };
  }

  if (CONSECUTIVE_SPECIAL.test(username)) {
    return {
      isValid: false,
      error:
        "UPI username must not contain consecutive special characters (e.g. '..', '--')",
      normalized,
    };
  }

  if (!handle) {
    return {
      isValid: false,
      error: "UPI handle (after '@') is required",
      normalized,
    };
  }

  if (!UPI_HANDLE_WHITELIST.has(handle)) {
    return {
      isValid: false,
      error: `Unsupported UPI handle '@${handle}'. Use a recognised Indian UPI handle (e.g. @ybl, @okaxis, @paytm)`,
      normalized,
    };
  }

  return { isValid: true, error: null, normalized };
}

/** Extract the handle (after '@') from a normalized or raw VPA. */
export function upiHandleFromId(upiId: string): string | null {
  const result = validateUpiId(upiId);
  if (!result.isValid || !result.normalized) return null;
  const handle = result.normalized.split("@")[1];
  return handle || null;
}
