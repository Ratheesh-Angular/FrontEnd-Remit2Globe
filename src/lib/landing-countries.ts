export type LandingCountry = {
  id: string;
  name: string;
  iso2: string;
  currency: string;
};

export const LANDING_COUNTRIES: LandingCountry[] = [
  { id: "ke", name: "Kenya", iso2: "KE", currency: "KES" },
  { id: "ca", name: "Canada", iso2: "CA", currency: "CAD" },
  { id: "ss", name: "South Sudan", iso2: "SS", currency: "SSP" },
  { id: "tz", name: "Tanzania", iso2: "TZ", currency: "TZS" },
  { id: "ug", name: "Uganda", iso2: "UG", currency: "UGX" },
  { id: "gb", name: "United Kingdom", iso2: "GB", currency: "GBP" },
];

export const DEFAULT_LANDING_COUNTRY =
  LANDING_COUNTRIES.find((c) => c.iso2 === "KE") ?? LANDING_COUNTRIES[0];

export function findLandingCountryById(id: string): LandingCountry | undefined {
  return LANDING_COUNTRIES.find((c) => c.id === id);
}
