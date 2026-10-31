"use client";

import { useState, useEffect, useCallback } from "react";
import type { FlexCountry } from "@/types/flex-country";
import { fetchCatalogCountries, toCountryAlpha3 } from "@/lib/catalog-countries";

/**
 * Platform country catalog (admin-managed per operation country).
 * Pass `countryCode` as ISO2 or ISO3 of the sender / operation country.
 */
export function useCatalogCountries(
  enabled = true,
  countryCode?: string | null,
): {
  countries: FlexCountry[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
} {
  const op = toCountryAlpha3(countryCode);
  const [countries, setCountries] = useState<FlexCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!op) {
      setCountries([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await fetchCatalogCountries(op);
      setCountries(list);
    } catch {
      setCountries([]);
      setError("Could not load countries");
    } finally {
      setLoading(false);
    }
  }, [op]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (!op) {
      setCountries([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    fetchCatalogCountries(op)
      .then((list) => {
        if (!cancelled) setCountries(list);
      })
      .catch(() => {
        if (!cancelled) {
          setCountries([]);
          setError("Could not load countries");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, op]);

  return { countries, loading, error, reload };
}
