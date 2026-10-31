"use client";

import { useEffect, useState } from "react";
import { sessionApi as api } from "@/lib/api";
import { toCountryAlpha3 } from "@/lib/catalog-countries";

type SenderContextLite = {
  senderCountryIso2?: string | null;
  senderCountryCode?: string | null;
  countryCode?: string | null;
};

/**
 * Resolves the logged-in user's operation country as ISO3 for payout catalog filtering.
 */
export function useSenderCountryAlpha3(enabled = true): {
  countryCode: string;
  loading: boolean;
} {
  const [countryCode, setCountryCode] = useState("");
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await api.get<{ data: SenderContextLite }>(
          "/remittance/context",
        );
        const data = res.data?.data;
        const raw =
          data?.senderCountryCode ??
          data?.countryCode ??
          data?.senderCountryIso2 ??
          "";
        const a3 = toCountryAlpha3(raw);
        if (!cancelled) setCountryCode(a3);
      } catch {
        if (!cancelled) setCountryCode("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { countryCode, loading };
}
