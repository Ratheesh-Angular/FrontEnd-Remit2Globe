"use client";

import { useState, useEffect, useCallback } from "react";
import type { FlexCountry } from "@/types/flex-country";
import { fetchFlexCountries } from "@/lib/flex-api";

export function useFlexCountries(enabled = true) {
  const [countries, setCountries] = useState<FlexCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchFlexCountries();
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
    fetchFlexCountries()
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

  const findByName = useCallback(
    (name: string) => {
      const t = name.trim();
      if (!t) return undefined;
      return countries.find(
        (c) => c.couName.toLowerCase() === t.toLowerCase(),
      );
    },
    [countries],
  );

  return { countries, loading, error, reload, findByName };
}
