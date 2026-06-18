/**
 * Delivery channels available per destination country (ISO 3166-1 alpha-3 couCode).
 * Business rules: all countries get bank transfer; Asia/Africa also get mobile money;
 * ARE, UGA, SSD, KEN also get payout in person.
 */

export type BeneficiaryDeliveryChannel =
  | "BANK_TRANSFER"
  | "MOBILE_MONEY"
  | "PAYOUT_IN_PERSON";

/** UN Africa region — ISO3 couCodes */
export const AFRICA_COUNTRIES = [
  "DZA",
  "AGO",
  "BEN",
  "BWA",
  "BFA",
  "BDI",
  "CPV",
  "CMR",
  "CAF",
  "TCD",
  "COM",
  "COG",
  "COD",
  "CIV",
  "DJI",
  "EGY",
  "GNQ",
  "ERI",
  "SWZ",
  "ETH",
  "GAB",
  "GMB",
  "GHA",
  "GIN",
  "GNB",
  "KEN",
  "LSO",
  "LBR",
  "LBY",
  "MDG",
  "MWI",
  "MLI",
  "MRT",
  "MUS",
  "MYT",
  "MAR",
  "MOZ",
  "NAM",
  "NER",
  "NGA",
  "REU",
  "RWA",
  "STP",
  "SEN",
  "SYC",
  "SLE",
  "SOM",
  "ZAF",
  "SSD",
  "SDN",
  "TZA",
  "TGO",
  "TUN",
  "UGA",
  "ZMB",
  "ZWE",
] as const;

/** UN Asia region — ISO3 couCodes */
export const ASIA_COUNTRIES = [
  "AFG",
  "ARM",
  "AZE",
  "BHR",
  "BGD",
  "BTN",
  "BRN",
  "KHM",
  "CHN",
  "CYP",
  "GEO",
  "HKG",
  "IND",
  "IDN",
  "IRN",
  "IRQ",
  "ISR",
  "JPN",
  "JOR",
  "KAZ",
  "PRK",
  "KOR",
  "KWT",
  "KGZ",
  "LAO",
  "LBN",
  "MAC",
  "MYS",
  "MDV",
  "MNG",
  "MMR",
  "NPL",
  "OMN",
  "PAK",
  "PSE",
  "PHL",
  "QAT",
  "SAU",
  "SGP",
  "LKA",
  "SYR",
  "TWN",
  "TJK",
  "THA",
  "TLS",
  "TKM",
  "TUR",
  "ARE",
  "UZB",
  "VNM",
  "YEM",
] as const;

export const PAYOUT_IN_PERSON_COUNTRIES = ["ARE", "UGA", "SSD", "KEN"] as const;

const AFRICA_COUNTRY_CODES = new Set<string>(AFRICA_COUNTRIES);
const ASIA_COUNTRY_CODES = new Set<string>(ASIA_COUNTRIES);
const PAYOUT_IN_PERSON_COUNTRY_CODES = new Set<string>(
  PAYOUT_IN_PERSON_COUNTRIES,
);

export function isAfricaCountryCode(countryCode: string): boolean {
  return AFRICA_COUNTRY_CODES.has(countryCode.trim().toUpperCase());
}

export function isAsiaCountryCode(countryCode: string): boolean {
  return ASIA_COUNTRY_CODES.has(countryCode.trim().toUpperCase());
}

export function getDeliveryChannels(
  countryCode: string,
): BeneficiaryDeliveryChannel[] {
  const code = countryCode.trim().toUpperCase();
  if (!code) return [];

  const channels: BeneficiaryDeliveryChannel[] = ["BANK_TRANSFER"];

  if (isAfricaCountryCode(code) || isAsiaCountryCode(code)) {
    channels.push("MOBILE_MONEY");
  }

  if (PAYOUT_IN_PERSON_COUNTRY_CODES.has(code)) {
    channels.push("PAYOUT_IN_PERSON");
  }

  return channels;
}

export const DELIVERY_CHANNEL_LABELS: Record<
  BeneficiaryDeliveryChannel,
  string
> = {
  BANK_TRANSFER: "Bank Transfer",
  MOBILE_MONEY: "Mobile Money",
  PAYOUT_IN_PERSON: "Payout In Person (cash collection)",
};

export function getDeliveryChannelLabel(
  channel: BeneficiaryDeliveryChannel,
): string {
  return DELIVERY_CHANNEL_LABELS[channel];
}
