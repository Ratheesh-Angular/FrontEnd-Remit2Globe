/**
 * Delivery channels available per destination country (ISO 3166-1 alpha-3 couCode).
 * Business rules: all countries get bank transfer; Asia/Africa also get mobile money;
 * ARE, UGA, SSD, KEN also get payout in person.
 */

import {
  isFlexBankServiceTypeAllowed,
  isFlexMobileWalletServiceType,
} from "@/lib/beneficiary-flex-banks";
import { validateEmiratesId } from "@/lib/emirates-id-validation";

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

/** Flex corridors that only support mobile wallet (no bank account service). */
export const MOBILE_WALLET_ONLY_COUNTRY_CODES = new Set([
  "CHN",
  "BDI",
  "SLE",
  "ZMB",
]);

/**
 * Flex lists cash-collection agents as serviceType "Bank" — not bank transfer.
 * Map those rows to PAYOUT_IN_PERSON instead of BANK_TRANSFER.
 */
export const FLEX_BANK_MEANS_PAYOUT_IN_PERSON_COUNTRY_CODES = new Set(["ZWE"]);

/**
 * Always expose Mobile Money even when Flex `/banks/{couCode}` has no Mobile Wallet rows.
 * (Static Africa/Asia rules include MOBILE_MONEY; Flex catalogs sometimes omit wallets.)
 */
export const FORCE_MOBILE_MONEY_COUNTRY_CODES = new Set([
  "KEN",
  "UGA",
  "RWA",
  "BDI",
  "TZA",
  "GHA",
]);

const AFRICA_COUNTRY_CODES = new Set<string>(AFRICA_COUNTRIES);
const ASIA_COUNTRY_CODES = new Set<string>(ASIA_COUNTRIES);
const PAYOUT_IN_PERSON_COUNTRY_CODES = new Set<string>(
  PAYOUT_IN_PERSON_COUNTRIES,
);

/** Insert MOBILE_MONEY in static-rule order when forced for the corridor. */
function withForcedMobileMoney(
  code: string,
  channels: BeneficiaryDeliveryChannel[],
): BeneficiaryDeliveryChannel[] {
  if (!FORCE_MOBILE_MONEY_COUNTRY_CODES.has(code)) return channels;
  if (channels.includes("MOBILE_MONEY")) return channels;

  const next = [...channels];
  const bankIdx = next.indexOf("BANK_TRANSFER");
  if (bankIdx >= 0) {
    next.splice(bankIdx + 1, 0, "MOBILE_MONEY");
    return next;
  }
  const payoutIdx = next.indexOf("PAYOUT_IN_PERSON");
  if (payoutIdx >= 0) {
    next.splice(payoutIdx, 0, "MOBILE_MONEY");
    return next;
  }
  next.push("MOBILE_MONEY");
  return next;
}

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

/**
 * Derive delivery channels from Flex `/banks/{couCode}` service types.
 * Mobile-wallet-only corridors (e.g. CHN) return only MOBILE_MONEY.
 */
export function getDeliveryChannelsFromFlexServices(
  countryCode: string,
  services: { serviceType?: string }[],
): BeneficiaryDeliveryChannel[] {
  const code = countryCode.trim().toUpperCase();
  if (!code) return [];

  if (services.length === 0) {
    if (MOBILE_WALLET_ONLY_COUNTRY_CODES.has(code)) {
      return ["MOBILE_MONEY"];
    }
    return getDeliveryChannels(code);
  }

  let hasBank = false;
  let hasMobileWallet = false;
  for (const row of services) {
    const t = String(row.serviceType ?? "").trim();
    if (!t) continue;
    if (isFlexBankServiceTypeAllowed(t)) hasBank = true;
    if (isFlexMobileWalletServiceType(t)) hasMobileWallet = true;
  }

  if (!hasBank && hasMobileWallet) {
    const channels: BeneficiaryDeliveryChannel[] = ["MOBILE_MONEY"];
    if (PAYOUT_IN_PERSON_COUNTRY_CODES.has(code)) {
      channels.push("PAYOUT_IN_PERSON");
    }
    return withForcedMobileMoney(code, channels);
  }

  if (FLEX_BANK_MEANS_PAYOUT_IN_PERSON_COUNTRY_CODES.has(code)) {
    const channels: BeneficiaryDeliveryChannel[] = [];
    if (hasMobileWallet) channels.push("MOBILE_MONEY");
    if (hasBank) channels.push("PAYOUT_IN_PERSON");
    return channels.length > 0
      ? withForcedMobileMoney(code, channels)
      : getDeliveryChannels(code);
  }

  const channels: BeneficiaryDeliveryChannel[] = [];
  if (hasBank) channels.push("BANK_TRANSFER");
  if (hasMobileWallet) channels.push("MOBILE_MONEY");

  if (channels.length === 0) {
    return getDeliveryChannels(code);
  }

  if (PAYOUT_IN_PERSON_COUNTRY_CODES.has(code)) {
    channels.push("PAYOUT_IN_PERSON");
  }

  return withForcedMobileMoney(code, channels);
}

export const DELIVERY_CHANNEL_LABELS: Record<
  BeneficiaryDeliveryChannel,
  string
> = {
  BANK_TRANSFER: "Bank Transfer",
  MOBILE_MONEY: "Mobile Money",
  PAYOUT_IN_PERSON: "Payout In Person (cash collection)",
};

/** UAE payout-in-person corridors collect Emirates ID; others use passport/national ID. */
export const PAYOUT_IN_PERSON_EMIRATES_ID_COUNTRY_CODE = "ARE" as const;

export type UaePayoutRecipientType = "RESIDENT" | "VISITOR";

/** Infer UAE payout recipient type from a stored ID value (edit mode). */
export function inferUaePayoutRecipientType(
  id: string,
): UaePayoutRecipientType | "" {
  const trimmed = id.trim();
  if (!trimmed) return "";
  return validateEmiratesId(trimmed) === null ? "RESIDENT" : "VISITOR";
}

export function isUaePayoutInPerson(
  destinationCouCode: string | undefined,
  channel: BeneficiaryDeliveryChannel,
): boolean {
  return (
    destinationCouCode === PAYOUT_IN_PERSON_EMIRATES_ID_COUNTRY_CODE &&
    channel === "PAYOUT_IN_PERSON"
  );
}

export function payoutInPersonNameSuffix(
  destinationCouCode: string | undefined,
  recipientType?: UaePayoutRecipientType | "",
): string {
  if (destinationCouCode === PAYOUT_IN_PERSON_EMIRATES_ID_COUNTRY_CODE) {
    if (recipientType === "VISITOR") return " (as per passport)";
    return " (as per emirates id)";
  }
  return " (as per passport/ national id)";
}

export function payoutInPersonIdFieldLabel(
  destinationCouCode: string | undefined,
): string {
  if (destinationCouCode === PAYOUT_IN_PERSON_EMIRATES_ID_COUNTRY_CODE) {
    return "Emirates Id Number";
  }
  return "Passport/national Id number";
}

export function beneficiaryNameLabelSuffix(
  channel: BeneficiaryDeliveryChannel,
  destinationCouCode: string | undefined,
  uaeRecipientType?: UaePayoutRecipientType | "",
): string {
  if (channel === "BANK_TRANSFER") return " (as per bank account)";
  if (channel === "PAYOUT_IN_PERSON") {
    return payoutInPersonNameSuffix(destinationCouCode, uaeRecipientType);
  }
  return "";
}

export function payoutInPersonCollectionNotice(
  destinationCouCode: string | undefined,
  countryName: string,
): string {
  if (destinationCouCode === PAYOUT_IN_PERSON_EMIRATES_ID_COUNTRY_CODE) {
    return "The beneficiary will collect funds in person at any Alfardan Exchange House branch in the United Arab Emirates.";
  }
  const place = countryName.trim() || "the selected country";
  return `The beneficiary will collect funds in person in ${place}. No bank or mobile wallet details are required.`;
}

export function getDeliveryChannelLabel(
  channel: BeneficiaryDeliveryChannel,
): string {
  return DELIVERY_CHANNEL_LABELS[channel];
}
