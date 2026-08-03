/**
 * UAE mobile-only phone validation.
 *
 * Accepts local (`05x…`) and international (`+9715x…` / `009715x…`) formats.
 * Landlines (prefixes other than mobile 50/52/54/55/56/58) are rejected.
 */

export type UaeMobileValidationResult = {
  isValid: boolean;
  error: string | null;
  /** Digits-only national mobile (9 digits, starting with 5), when valid. */
  nationalDigits?: string | null;
  /** E.164 form `+9715xxxxxxx` when valid. */
  e164?: string | null;
};

/** Second digit after the leading 5 (UAE mobile operator codes). */
const UAE_MOBILE_SECOND_DIGITS = new Set(["0", "2", "4", "5", "6", "8"]);

/**
 * Strip whitespace, hyphens, parentheses, and other specials except a leading `+`.
 */
export function cleanUaeMobileInput(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const rest = (hasPlus ? trimmed.slice(1) : trimmed).replace(/[^\d]/g, "");
  return hasPlus ? `+${rest}` : rest;
}

function isAllowedMobileSecondDigit(d: string | undefined): boolean {
  return Boolean(d && UAE_MOBILE_SECOND_DIGITS.has(d));
}

/**
 * Validate a UAE mobile number (mobile-only; landlines blocked).
 */
export function validateUaeMobileNumber(
  input: unknown,
): UaeMobileValidationResult {
  if (input == null || typeof input !== "string") {
    return { isValid: false, error: "Mobile number is required" };
  }

  const cleaned = cleanUaeMobileInput(input);
  if (!cleaned) {
    return { isValid: false, error: "Mobile number is required" };
  }

  // Local domestic: 05X XXX XXXX → exactly 10 digits, X ∈ {0,2,4,5,6,8}
  if (cleaned.startsWith("05") && !cleaned.startsWith("00971")) {
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length !== 10) {
      return {
        isValid: false,
        error: "UAE mobile numbers must be exactly 10 digits (e.g. 0501234567)",
      };
    }
    const second = digits[2];
    if (!isAllowedMobileSecondDigit(second)) {
      return {
        isValid: false,
        error:
          "Landline numbers are not allowed, please use a mobile number starting with 5",
      };
    }
    const national = digits.slice(1); // 5XXXXXXXX (9 digits)
    return {
      isValid: true,
      error: null,
      nationalDigits: national,
      e164: `+971${national}`,
    };
  }

  // International: +9715X… or 009715X…
  let afterCountry = "";
  if (cleaned.startsWith("+971")) {
    afterCountry = cleaned.slice(4).replace(/\D/g, "");
  } else if (cleaned.startsWith("00971")) {
    afterCountry = cleaned.slice(5).replace(/\D/g, "");
  } else if (cleaned.startsWith("971") && cleaned.replace(/\D/g, "").length === 12) {
    // Bare 9715XXXXXXXX without +
    afterCountry = cleaned.replace(/\D/g, "").slice(3);
  } else {
    // Could be national digits entered in the flag+dial UI (9 digits starting with 5)
    const digitsOnly = cleaned.replace(/\D/g, "");
    if (digitsOnly.length === 9 && digitsOnly.startsWith("5")) {
      const second = digitsOnly[1];
      if (!isAllowedMobileSecondDigit(second)) {
        return {
          isValid: false,
          error:
            "Landline numbers are not allowed, please use a mobile number starting with 5",
        };
      }
      return {
        isValid: true,
        error: null,
        nationalDigits: digitsOnly,
        e164: `+971${digitsOnly}`,
      };
    }
    if (digitsOnly.length === 10 && digitsOnly.startsWith("05")) {
      // already handled above; fall through
    }
    return {
      isValid: false,
      error:
        "Enter a valid UAE mobile number (05x… or +9715x…). Landlines are not allowed",
    };
  }

  if (afterCountry.length !== 9) {
    return {
      isValid: false,
      error:
        "UAE mobile numbers must have exactly 9 digits after the country code (+971)",
    };
  }

  if (!afterCountry.startsWith("5")) {
    return {
      isValid: false,
      error:
        "Landline numbers are not allowed, please use a mobile number starting with 5",
    };
  }

  const second = afterCountry[1];
  if (!isAllowedMobileSecondDigit(second)) {
    return {
      isValid: false,
      error:
        "Landline numbers are not allowed, please use a mobile number starting with 5",
    };
  }

  return {
    isValid: true,
    error: null,
    nationalDigits: afterCountry,
    e164: `+971${afterCountry}`,
  };
}

/**
 * Validate national digits typed beside a +971 dial prefix (UI pattern).
 * Expects 9 digits starting with 5, second digit in {0,2,4,5,6,8}.
 */
export function validateUaeMobileNationalDigits(
  nationalDigits: string,
): UaeMobileValidationResult {
  const digits = String(nationalDigits ?? "").replace(/\D/g, "");
  if (!digits) {
    return { isValid: false, error: "Mobile number is required" };
  }
  return validateUaeMobileNumber(`+971${digits}`);
}
