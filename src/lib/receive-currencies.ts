import { sessionApi as api } from "@/lib/api";
import { legalCurrencyForCouCode } from "@/lib/send-money-currencies";

export type ReceiveCurrencyResolution = {
  receiveCurrencies: string[];
  defaultReceiveCurrency: string;
  localCurrency: string;
};

/** Fallback matching pre-admin hardcoded list: local + USD/EUR/GBP. */
export function defaultReceiveCurrenciesForCountry(
  countryCodeIso3: string,
): ReceiveCurrencyResolution {
  const local = legalCurrencyForCouCode(countryCodeIso3);
  const majors = ["USD", "EUR", "GBP"];
  const receiveCurrencies = Array.from(
    new Set(local ? [local, ...majors] : majors),
  );
  return {
    receiveCurrencies,
    defaultReceiveCurrency: local || receiveCurrencies[0] || "USD",
    localCurrency: local || "USD",
  };
}

export async function fetchReceiveCurrenciesForCountry(
  countryCodeIso3: string,
): Promise<ReceiveCurrencyResolution> {
  const code = countryCodeIso3.trim().toUpperCase();
  if (!code || code.length !== 3) {
    return {
      receiveCurrencies: ["USD"],
      defaultReceiveCurrency: "USD",
      localCurrency: "USD",
    };
  }

  try {
    const { data } = await api.get<{ data: ReceiveCurrencyResolution }>(
      "/remittance/receive-currencies",
      { params: { countryCode: code } },
    );
    const payload = data.data;
    if (
      payload?.receiveCurrencies?.length &&
      Array.isArray(payload.receiveCurrencies)
    ) {
      return {
        receiveCurrencies: payload.receiveCurrencies.map((c) =>
          String(c).toUpperCase(),
        ),
        defaultReceiveCurrency: String(
          payload.defaultReceiveCurrency ||
            payload.localCurrency ||
            payload.receiveCurrencies[0],
        ).toUpperCase(),
        localCurrency: String(
          payload.localCurrency || legalCurrencyForCouCode(code),
        ).toUpperCase(),
      };
    }
  } catch {
    // Fall through to defaults.
  }

  return defaultReceiveCurrenciesForCountry(code);
}
