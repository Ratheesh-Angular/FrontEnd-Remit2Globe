import countriesIso from "i18n-iso-countries";

/** ISO 3166-1 alpha-3 → receive currency (full static catalog in send-money). */
export const COU_CODE_TO_CURRENCY: Record<string, string> = {
  AFG: "AFN",
  DZA: "DZD",
  AUS: "AUD",
  AZE: "AZN",
  BHR: "BHD",
  BGD: "BDT",
  BLR: "BYN",
  BRA: "BRL",
  BGR: "BGN",
  KHM: "KHR",
  CMR: "XAF",
  CAN: "CAD",
  CHN: "CNY",
  COD: "CDF",
  CZE: "CZK",
  EGY: "EGP",
  EST: "EUR",
  ETH: "ETB",
  FIN: "EUR",
  FRA: "EUR",
  DEU: "EUR",
  GRC: "EUR",
  HKG: "HKD",
  HUN: "HUF",
  IND: "INR",
  IDN: "IDR",
  ITA: "EUR",
  JPN: "JPY",
  KEN: "KES",
  KWT: "KWD",
  LVA: "EUR",
  LTU: "EUR",
  MDG: "MGA",
  MWI: "MWK",
  MYS: "MYR",
  MDA: "MDL",
  MAR: "MAD",
  NPL: "NPR",
  NLD: "EUR",
  NGA: "NGN",
  PAK: "PKR",
  PHL: "PHP",
  POL: "PLN",
  ROU: "RON",
  RUS: "RUB",
  SEN: "XOF",
  SGP: "SGD",
  SVK: "EUR",
  ZAF: "ZAR",
  ESP: "EUR",
  LKA: "LKR",
  SWE: "SEK",
  CHE: "CHF",
  TZA: "TZS",
  THA: "THB",
  UKR: "UAH",
  ARE: "AED",
  GBR: "GBP",
  USA: "USD",
  ZMB: "ZMW",
  SSD: "SSP",
  UGA: "UGX",
  BEL: "EUR",
  CYP: "EUR",
  DNK: "DKK",
  IRL: "EUR",
  LUX: "EUR",
  NOR: "NOK",
  PRT: "EUR",
  SOM: "SOS",
  LBN: "LBP",
  ERI: "ERN",
  QAT: "QAR",
  BEN: "XOF",
  BMU: "BMD",
  BFA: "XOF",
  BDI: "BIF",
  COG: "XAF",
  GEO: "GEL",
  GHA: "GHS",
  CIV: "XOF",
  KAZ: "KZT",
  KGZ: "KGS",
  LBR: "LRD",
  MLT: "EUR",
  MTQ: "EUR",
  MCO: "EUR",
  NAM: "NAD",
  NZL: "NZD",

  NER: "XOF",
  RWA: "RWF",
  SMR: "EUR",
  SLE: "SLE",
  SVN: "EUR",
  TJK: "TJS",
  UZB: "UZS",
  VNM: "VND",
  ZWE: "ZWL",
  ALB: "ALL",
  AND: "EUR",
  ARM: "AMD",
  AUT: "EUR",
  BIH: "BAM",
  HRV: "EUR",
  ISL: "ISK",
  LIE: "CHF",
  MNE: "EUR",
  MKD: "MKD",
  SRB: "RSD",
  VAT: "EUR",
};

/** ISO2 → pay/receive currency (aligned with backend remittance.constants). */
export const ALPHA2_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  IN: "INR",
  KE: "KES",
  SS: "SSP",
  TZ: "TZS",
  UG: "UGX",
  RW: "RWF",
  GH: "GHS",
  NG: "NGN",
  ZA: "ZAR",
  AE: "AED",
  SA: "SAR",
  PK: "PKR",
  BD: "BDT",
  PH: "PHP",
};

/**
 * Legal (local) receive/payout currency for a Flex ISO3 country code.
 * Falls back to alpha-2 mapping, then USD when unknown.
 */
export function legalCurrencyForCouCode(couCode: string): string {
  const a3 = couCode?.trim().toUpperCase();
  if (!a3) return "USD";
  const fromAlpha3 = COU_CODE_TO_CURRENCY[a3];
  if (fromAlpha3) return fromAlpha3;
  const a2 = countriesIso.alpha3ToAlpha2(a3);
  if (typeof a2 === "string" && ALPHA2_TO_CURRENCY[a2]) {
    return ALPHA2_TO_CURRENCY[a2];
  }
  return "USD";
}

/** ISO 4217 → flag (alpha-2) for display in currency selectors. */
export const CURRENCY_TO_FLAG_ALPHA2: Record<string, string> = {
  USD: "US",
  EUR: "DE",
  GBP: "GB",
  INR: "IN",
  KES: "KE",
  SSP: "SS",
  TZS: "TZ",
  UGX: "UG",
  RWF: "RW",
  GHS: "GH",
  NGN: "NG",
  ZAR: "ZA",
  AED: "AE",
  SAR: "SA",
  PKR: "PK",
  BDT: "BD",
  PHP: "PH",
  CAD: "CA",
  CNY: "CN",
  JPY: "JP",
  CHF: "CH",
  BRL: "BR",
  RUB: "RU",
  PLN: "PL",
  SEK: "SE",
  NOK: "NO",
  DKK: "DK",
  HKD: "HK",
  QAR: "QA",
  KWD: "KW",
  EGP: "EG",
  MAD: "MA",
  LKR: "LK",
  NPR: "NP",
  UAH: "UA",
  CZK: "CZ",
  HUF: "HU",
  RON: "RO",
  BGN: "BG",
  XAF: "CM",
  XOF: "SN",
  CDF: "CD",
  ETB: "ET",
  MGA: "MG",
  MWK: "MW",
  MDL: "MD",
  BIF: "BI",
  GEL: "GE",
  KZT: "KZ",
  KGS: "KG",
  LRD: "LR",
  NAD: "NA",
  SLE: "SL",
  TJS: "TJ",
  UZS: "UZ",
  ZMW: "ZM",
  ZWL: "ZW",
  AFN: "AF",
  DZD: "DZ",
  AZN: "AZ",
  BHD: "BH",
  BYN: "BY",
  KHR: "KH",
  BMD: "BM",
  ERN: "ER",
  LBP: "LB",
  SOS: "SO",
  AUD: "AU",
  NZD: "NZ",
  SGD: "SG",
  MYR: "MY",
  THB: "TH",
  IDR: "ID",
  VND: "VN",
  ALL: "AL",
  AMD: "AM",
  BAM: "BA",
  ISK: "IS",
  MKD: "MK",
  RSD: "RS",
};

/** ISO3 country to show for a receive currency when multiple catalog rows map to it. */
export const PREFERRED_COU_CODE_FOR_RECEIVE_CURRENCY: Record<string, string> = {
  USD: "USA",
};

/** One row per receive currency; maps back to a catalog country for display & quotes. */
export type RecipientReceiveOption = {
  currency: string;
  couCode: string;
  couName: string;
};

export function dedupeCatalogCountries<
  T extends { couCode: string },
>(countries: T[]): T[] {
  const byCode = new Map<string, T>();
  for (const c of countries) {
    if (!byCode.has(c.couCode)) byCode.set(c.couCode, c);
  }
  return [...byCode.values()];
}

/** Unique receive currencies from the full catalog (one representative country each). */
export function buildRecipientCurrencyOptions(
  catalogCountries: { couCode: string; couName: string }[],
): RecipientReceiveOption[] {
  const byCurrency = new Map<string, RecipientReceiveOption>();
  for (const c of dedupeCatalogCountries(catalogCountries)) {
    const currency = legalCurrencyForCouCode(c.couCode);
    const opt: RecipientReceiveOption = {
      currency,
      couCode: c.couCode,
      couName: c.couName,
    };
    const existing = byCurrency.get(currency);
    const preferred =
      PREFERRED_COU_CODE_FOR_RECEIVE_CURRENCY[currency.toUpperCase()];
    if (!existing) {
      byCurrency.set(currency, opt);
      continue;
    }
    if (preferred && c.couCode.toUpperCase() === preferred) {
      byCurrency.set(currency, opt);
    }
  }
  return [...byCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
}

export function payCurrencyFlagCode(currency: string): string {
  return CURRENCY_TO_FLAG_ALPHA2[currency.toUpperCase()] ?? "US";
}

export function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const AFRICAN_MOBILE_PAYIN_ISO2 = new Set([
  "KE",
  "TZ",
  "UG",
  "RW",
  "GH",
  "NG",
  "ZA",
  "ZM",
  "ZW",
  "SN",
  "CI",
  "CM",
  "ET",
]);
