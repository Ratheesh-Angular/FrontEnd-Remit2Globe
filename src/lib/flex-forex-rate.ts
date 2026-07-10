import { flexApiUrl } from "@/lib/flex-api";

export function buildFlexCurrPair(
  fromCurrency: string,
  toCurrency: string,
): string {
  return `${fromCurrency.trim().toUpperCase()} - ${toCurrency.trim().toUpperCase()}`;
}

function pushFlexRateCandidates(
  candidates: unknown[],
  row: unknown,
): void {
  if (!row || typeof row !== "object") return;
  const r = row as Record<string, unknown>;
  candidates.push(r.rate, r.forexRate, r.currencyRate, r.exchangeRate);
}

/** Extract numeric rate from Flex forexRate response (or our BFF wrapper). */
export function parseFlexForexRateResponse(json: unknown): number | null {
  if (json == null) return null;

  const candidates: unknown[] = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      pushFlexRateCandidates(candidates, item);
    }
  } else if (typeof json === "object") {
    const root = json as Record<string, unknown>;
    pushFlexRateCandidates(candidates, root);

    if (root.data && typeof root.data === "object") {
      const data = root.data as Record<string, unknown> | unknown[];
      if (Array.isArray(data)) {
        for (const item of data) {
          pushFlexRateCandidates(candidates, item);
        }
      } else {
        pushFlexRateCandidates(candidates, data);
      }
    }
  } else {
    return null;
  }

  for (const value of candidates) {
    if (value == null) continue;
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? parseFloat(value.replace(/,/g, ""))
          : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

export async function fetchFlexForexRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<{ rate: number; currPair: string; raw: unknown }> {
  const currPair = buildFlexCurrPair(fromCurrency, toCurrency);
  const res = await fetch(flexApiUrl("/forex-rate"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currPair }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof raw === "object" &&
      raw !== null &&
      "error" in raw &&
      typeof (raw as { error?: unknown }).error === "string"
        ? (raw as { error: string }).error
        : `Flex forex rate failed (${res.status})`;
    throw new Error(msg);
  }

  const rate = parseFlexForexRateResponse(raw);
  if (rate == null) {
    throw new Error("Flex forex rate response did not include a usable rate");
  }

  return { rate, currPair, raw };
}

/** Forward + reverse Flex rates; derives missing direction as reciprocal when Flex only lists one pair. */
export async function fetchFlexForexRateBidirectional(
  fromCurrency: string,
  toCurrency: string,
): Promise<{
  forwardRate: number;
  reverseRate: number;
  currPair: string;
}> {
  const [forwardResult, reverseResult] = await Promise.allSettled([
    fetchFlexForexRate(fromCurrency, toCurrency),
    fetchFlexForexRate(toCurrency, fromCurrency),
  ]);

  if (forwardResult.status === "fulfilled") {
    const forwardRate = forwardResult.value.rate;
    const reverseRate =
      reverseResult.status === "fulfilled"
        ? reverseResult.value.rate
        : 1 / forwardRate;
    return {
      forwardRate,
      reverseRate,
      currPair: forwardResult.value.currPair,
    };
  }

  if (reverseResult.status === "fulfilled") {
    const reverseRate = reverseResult.value.rate;
    return {
      forwardRate: 1 / reverseRate,
      reverseRate,
      currPair: buildFlexCurrPair(fromCurrency, toCurrency),
    };
  }

  throw forwardResult.reason;
}
