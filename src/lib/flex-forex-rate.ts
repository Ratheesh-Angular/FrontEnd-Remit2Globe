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

async function tryFlexRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  try {
    const { rate } = await fetchFlexForexRate(fromCurrency, toCurrency);
    return rate;
  } catch {
    return null;
  }
}

/**
 * Resolve Flex rate for pay→receive: receiveAmount = payAmount × rate.
 * Tries FROM-TO first, then TO-FROM (returns Flex value as-is for either pair).
 * Matches backend resolveFlexExchangeRate semantics.
 */
export async function resolveFlexExchangeRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) {
    throw new Error("Currency pair is required");
  }
  if (from === to) return 1;

  const forwardRate = await tryFlexRate(from, to);
  if (forwardRate != null) return forwardRate;

  const reverseRate = await tryFlexRate(to, from);
  if (reverseRate != null) return reverseRate;

  throw new Error(`Flex did not return a rate for ${from} → ${to}`);
}

/** @deprecated Use resolveFlexExchangeRate for corridor rates. */
export async function fetchFlexForexRateBidirectional(
  fromCurrency: string,
  toCurrency: string,
): Promise<{
  forwardRate: number;
  reverseRate: number;
  currPair: string;
}> {
  const rate = await resolveFlexExchangeRate(fromCurrency, toCurrency);
  return {
    forwardRate: rate,
    reverseRate: rate,
    currPair: buildFlexCurrPair(fromCurrency, toCurrency),
  };
}
