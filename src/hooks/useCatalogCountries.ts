import { useMemo } from "react";
import type { FlexCountry } from "@/types/flex-country";
import { getCatalogCountries } from "@/lib/catalog-countries";

/**
 * Static full-country list for KYC / issuing-country fields (not admin Flex allowlist).
 * Same ergonomic shape as {@link useFlexCountries} for easy reuse.
 */
export function useCatalogCountries(enabled = true): {
  countries: FlexCountry[];
  loading: boolean;
  error: string;
} {
  return useMemo(() => {
    if (!enabled) {
      return { countries: [], loading: false, error: "" };
    }
    try {
      return {
        countries: getCatalogCountries(),
        loading: false,
        error: "",
      };
    } catch {
      return {
        countries: [],
        loading: false,
        error: "Could not load countries",
      };
    }
  }, [enabled]);
}
