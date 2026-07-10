"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANDING_COUNTRY,
  findLandingCountryById,
  type LandingCountry,
} from "@/lib/landing-countries";

type LandingCountryContextValue = {
  selectedCountry: LandingCountry;
  setSelectedCountryId: (id: string) => void;
  payCurrency: string;
  setPayCurrency: (currency: string) => void;
  payCurrencyOptions: string[];
};

const LandingCountryContext = createContext<LandingCountryContextValue | null>(
  null,
);

export function LandingCountryProvider({ children }: { children: ReactNode }) {
  const [selectedCountry, setSelectedCountry] = useState<LandingCountry>(
    DEFAULT_LANDING_COUNTRY,
  );
  const [payCurrency, setPayCurrency] = useState(
    DEFAULT_LANDING_COUNTRY.currency,
  );

  const payCurrencyOptions = useMemo(
    () => [selectedCountry.currency, "USD"],
    [selectedCountry.currency],
  );

  const setSelectedCountryId = useCallback((id: string) => {
    const country = findLandingCountryById(id);
    if (!country) return;
    setSelectedCountry(country);
    setPayCurrency(country.currency);
  }, []);

  const value = useMemo(
    () => ({
      selectedCountry,
      setSelectedCountryId,
      payCurrency,
      setPayCurrency,
      payCurrencyOptions,
    }),
    [selectedCountry, setSelectedCountryId, payCurrency, payCurrencyOptions],
  );

  return (
    <LandingCountryContext.Provider value={value}>
      {children}
    </LandingCountryContext.Provider>
  );
}

export function useLandingCountry() {
  const ctx = useContext(LandingCountryContext);
  if (!ctx) {
    throw new Error("useLandingCountry must be used within LandingCountryProvider");
  }
  return ctx;
}
