/** Emirates ID: 784-YYYY-NNNNNNN-C (15 digits, Luhn check digit). */

const EMIRATES_ID_FORMAT_RE =
  /^(784)[- ]?[0-9]{4}[- ]?[0-9]{7}[- ]?[0-9]{1}$/;

const EMIRATES_ID_HINT = "784-YYYY-NNNNNNN-C";

export function emiratesIdFormatHint(): string {
  return EMIRATES_ID_HINT;
}

/** Keep digits, hyphens, and spaces only; cap at formatted length. */
export function sanitizeEmiratesId(raw: string): string {
  return raw.replace(/[^\d- ]/g, "").slice(0, 18);
}

function cleanEmiratesIdDigits(value: string): string {
  return value.replace(/[- ]/g, "");
}

function passesLuhnChecksum(digits15: string): boolean {
  if (digits15.length !== 15 || !/^\d{15}$/.test(digits15)) return false;

  let sum = 0;
  let double = false;
  for (let i = digits15.length - 1; i >= 0; i--) {
    let digit = parseInt(digits15[i]!, 10);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function birthYearFromEmiratesId(digits15: string): number | null {
  const year = parseInt(digits15.slice(3, 7), 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Returns an error message when invalid, or null when valid / not yet checkable.
 */
export function validateEmiratesId(
  idString: string,
  options?: {
    allowEmpty?: boolean;
    /** While typing, skip length/checksum until 15 digits are entered. */
    allowIncomplete?: boolean;
  },
): string | null {
  const trimmed = idString.trim();
  if (!trimmed) {
    return options?.allowEmpty ? null : "Emirates Id Number is required";
  }

  if (/[^\d- ]/.test(trimmed)) {
    return "Emirates ID may only contain digits, hyphens, or spaces";
  }

  const digits = cleanEmiratesIdDigits(trimmed);

  if (digits.length > 15) {
    return "Emirates ID must be exactly 15 digits";
  }

  if (digits.length >= 3 && !digits.startsWith("784")) {
    return "Emirates ID must start with 784 (UAE country code)";
  }

  if (options?.allowIncomplete && digits.length < 15) {
    return null;
  }

  if (digits.length < 15) {
    return `Emirates ID must be exactly 15 digits (format: ${EMIRATES_ID_HINT})`;
  }

  if (!EMIRATES_ID_FORMAT_RE.test(trimmed)) {
    return `Invalid Emirates ID format. Expected: ${EMIRATES_ID_HINT}`;
  }

  const birthYear = birthYearFromEmiratesId(digits);
  const currentYear = new Date().getFullYear();
  if (
    birthYear == null ||
    birthYear < 1900 ||
    birthYear > currentYear
  ) {
    return "Emirates ID contains an invalid birth year";
  }

  if (!passesLuhnChecksum(digits)) {
    return "Invalid Emirates ID check digit";
  }

  return null;
}
