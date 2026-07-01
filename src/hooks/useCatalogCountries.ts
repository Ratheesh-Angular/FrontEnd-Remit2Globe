"use client";

import { useState, useEffect, useCallback } from "react";
import type { FlexCountry } from "@/types/flex-country";
import { fetchCatalogCountries } from "@/lib/catalog-countries";

/**
 * Platform country catalog (admin-managed). Fetches from API at runtime.
 * Same ergonomic shape as {@link useFlexCountries} for easy reuse.
 */
export function useCatalogCountries(enabled = true): {
  countries: FlexCountry[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
} {
  const [countries, setCountries] = useState<FlexCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchCatalogCountries();
      setCountries(list);
    } catch {
      setCountries([]);
      setError("Could not load countries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchCatalogCountries()
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
  }, [enabled]);

  return { countries, loading, error, reload };
}
