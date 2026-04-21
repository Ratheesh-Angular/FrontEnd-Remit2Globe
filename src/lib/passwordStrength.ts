export type PasswordStrength = "weak" | "medium" | "strong";

/** Live feedback while typing; submit still requires full strong policy (see meetsStrongPassword). */
export function getPasswordStrength(password: string): PasswordStrength {
  const len = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (len >= 8 && hasLower && hasUpper && hasDigit && hasSpecial) {
    return "strong";
  }

  const classCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(
    Boolean,
  ).length;
  if (len >= 8 && classCount >= 3) {
    return "medium";
  }

  return "weak";
}

/** Matches backend assertStrongPassword — enable submit when true. */
export function meetsStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

export type PasswordRequirementRow = {
  id: string;
  met: boolean;
  /** Primary line shown in the checklist */
  text: string;
};

/** Checklist rows for UI — labels match product copy. */
export function getPasswordRequirementRows(
  password: string,
): PasswordRequirementRow[] {
  return [
    {
      id: "length",
      met: password.length >= 8,
      text: "8 characters",
    },
    {
      id: "lower",
      met: /[a-z]/.test(password),
      text: "A lowercase letter (a-z)",
    },
    {
      id: "upper",
      met: /[A-Z]/.test(password),
      text: "A uppercase letter (A-Z)",
    },
    {
      id: "special",
      met: /[^A-Za-z0-9]/.test(password),
      text: "A special character (e.g. !@#$)",
    },
    {
      id: "number",
      met: /\d/.test(password),
      text: "A number (1-9)",
    },
  ];
}
