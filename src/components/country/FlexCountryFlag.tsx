"use client";

import type { CSSProperties } from "react";
import Flag from "react-world-flags";
import countriesIso from "i18n-iso-countries";

function alpha2FromCouCode(couCode: string): string | undefined {
  const u = couCode?.trim().toUpperCase();
  if (!u) return undefined;
  return countriesIso.alpha3ToAlpha2(u) || undefined;
}

export function FlexCountryFlag({
  couCode,
  style,
}: {
  couCode: string;
  style?: CSSProperties;
}) {
  const a2 = alpha2FromCouCode(couCode);
  if (a2) {
    return (
      <Flag
        code={a2.toLowerCase()}
        style={{
          width: 20,
          height: 14,
          borderRadius: 2,
          objectFit: "cover",
          ...style,
        }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 bg-slate-200 rounded text-[8px] font-semibold text-slate-600 uppercase"
      style={{ width: 20, height: 14, ...style }}
    >
      {couCode.slice(0, 2)}
    </span>
  );
}
