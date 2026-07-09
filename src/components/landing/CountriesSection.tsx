"use client";

import Image from "next/image";
import { Globe } from "lucide-react";

const FEATURED_COUNTRIES = [
  { name: "India", code: "in", currency: "INR" },
  { name: "Kenya", code: "ke", currency: "KES" },
  { name: "Ghana", code: "gh", currency: "GHS" },
  { name: "Nigeria", code: "ng", currency: "NGN" },
  { name: "Uganda", code: "ug", currency: "UGX" },
  { name: "Tanzania", code: "tz", currency: "TZS" },
  { name: "Pakistan", code: "pk", currency: "PKR" },
  { name: "Bangladesh", code: "bd", currency: "BDT" },
  { name: "Philippines", code: "ph", currency: "PHP" },
  { name: "United Kingdom", code: "gb", currency: "GBP" },
  { name: "United Arab Emirates", code: "ae", currency: "AED" },
  { name: "South Africa", code: "za", currency: "ZAR" },
];

export function CountriesSection() {
  return (
    <section id="countries" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-sm font-medium mb-4">
            <Globe className="w-4 h-4" />
            <span>100+ Countries Supported</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Send Money Worldwide
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Transfer to family and friends in Africa, Asia, Europe, and beyond.
            Bank accounts, mobile wallets, and cash pickup available.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-6">
          {FEATURED_COUNTRIES.map((country) => (
            <div
              key={country.name}
              className="flex flex-col items-center gap-3 p-4 lg:p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-red-200 hover:shadow-md transition-all cursor-default"
            >
              <Image
                src={`https://flagcdn.com/w80/${country.code}.png`}
                alt={`${country.name} flag`}
                width={48}
                height={36}
                className="rounded shadow-sm"
                unoptimized
              />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-900 leading-tight">
                  {country.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {country.currency}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500">
            And many more including USA, Canada, Europe, Australia, and across
            Asia and Africa.
          </p>
        </div>
      </div>
    </section>
  );
}
