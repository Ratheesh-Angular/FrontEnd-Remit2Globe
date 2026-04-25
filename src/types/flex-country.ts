/**
 * Remittance (Flex) country row — `couName` is the human label; `couCode` is
 * the ISO alpha-3 (or provider) code used for flags and bank lookups.
 */
export type FlexCountry = {
  couCode: string;
  couName: string;
};
