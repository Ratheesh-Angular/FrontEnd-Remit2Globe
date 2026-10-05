import { sessionApi } from "@/lib/api";

/**
 * Customer rate for the logged-in sender: Flex offered rate minus the admin
 * margin for the sender's country (or the plain offered rate when none is active).
 * Rate is units of `to` per 1 unit of `from`.
 */
export async function fetchCustomerExchangeRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) {
    throw new Error("Currency pair is required");
  }
  if (from === to) return 1;

  const { data } = await sessionApi.get<{ data: { rate: number } }>(
    "/remittance/rate",
    { params: { fromCurrency: from, toCurrency: to } },
  );
  const rate = Number(data?.data?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No exchange rate available for ${from} → ${to}`);
  }
  return rate;
}
