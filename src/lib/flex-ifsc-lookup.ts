export type FlexIfscLookupResult = {
  bank: string;
  branch: string;
};

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Split Flex `utilityName` into bank (before first " - ") and branch (after).
 * Examples:
 * - "STATE BANK OF INDIA - TRIPUNITHURA  KERALA"
 * - "CANARA BANK - COLLEGE ROAD MAIN,NAGERCOIL"
 */
export function splitFlexUtilityName(utilityName: string): {
  bank: string;
  branch: string;
} {
  const trimmed = utilityName.trim();
  if (!trimmed) return { bank: "", branch: "" };

  const parts = trimmed.split(/\s+-\s+/, 2);
  if (parts.length === 2) {
    return {
      bank: parts[0]!.trim(),
      branch: parts[1]!.trim(),
    };
  }

  return { bank: trimmed, branch: "" };
}

/**
 * Parse Flex `/ifscValidate` response into bank + branch for beneficiary forms.
 */
export function parseFlexIfscLookup(
  data: Record<string, unknown>,
): FlexIfscLookupResult | null {
  const found = data.found;
  if (found === false || found === "false") return null;

  const utilityName =
    typeof data.utilityName === "string" ? data.utilityName.trim() : "";

  if (utilityName) {
    const { bank, branch } = splitFlexUtilityName(utilityName);
    if (bank) return { bank, branch };
  }

  const bank = pickString(
    data,
    "BANK",
    "bank",
    "bankName",
    "BANKNAME",
    "BankName",
  );
  const branch = pickString(
    data,
    "BRANCH",
    "branch",
    "branchName",
    "BRANCHNAME",
    "BranchName",
  );
  if (!bank && !branch) return null;
  return { bank, branch };
}
