/** Flex bank list entries allowed in the bank picker (excludes mobile wallet). */
export const FLEX_BANK_SERVICE_TYPES = new Set(["Bank Account", "Bank"]);

/**
 * Countries where Flex returns an "All Banks …" aggregate entry and the user
 * must enter their actual institution name separately.
 */
export const ALL_BANKS_COUNTRY_CODES = new Set([
  "BEL",
  "BGR",
  "CYP",
  "CZE",
  "DNK",
  "EST",
  "FIN",
  "FRA",
  "DEU",
  "GRC",
  "HUN",
  "ISL",
  "IRL",
  "ITA",
  "LVA",
  "LIE",
  "LTU",
  "LUX",
  "MLT",
  "MCO",
  "NLD",
  "NOR",
  "POL",
  "PRT",
  "ROU",
  "SVK",
  "SVN",
  "ESP",
  "SWE",
  "CHE",
]);

export function isFlexBankServiceTypeAllowed(serviceType: string | undefined): boolean {
  const t = (serviceType ?? "").trim();
  if (!t) return true;
  return FLEX_BANK_SERVICE_TYPES.has(t);
}

export function isAllBanksCountry(couCode: string | undefined | null): boolean {
  const code = (couCode ?? "").trim().toUpperCase();
  return code.length > 0 && ALL_BANKS_COUNTRY_CODES.has(code);
}

export function isAllBanksFlexEntryName(bankName: string | undefined | null): boolean {
  return /^all banks\b/i.test((bankName ?? "").trim());
}

export function requiresActualBankNameInput(
  couCode: string | undefined | null,
  flexBankName: string | undefined | null,
): boolean {
  return isAllBanksCountry(couCode) && isAllBanksFlexEntryName(flexBankName);
}
