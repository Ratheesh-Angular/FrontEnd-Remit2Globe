"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";

type Country = {
  couCode: string;
  couName: string;
  currency: string;
  code2: string;
};

const POPULAR_COUNTRIES: Country[] = [
  { couCode: "IND", couName: "India", currency: "INR", code2: "in" },
  { couCode: "KEN", couName: "Kenya", currency: "KES", code2: "ke" },
  { couCode: "GHA", couName: "Ghana", currency: "GHS", code2: "gh" },
  { couCode: "TZA", couName: "Tanzania", currency: "TZS", code2: "tz" },
  { couCode: "UGA", couName: "Uganda", currency: "UGX", code2: "ug" },
  { couCode: "NGA", couName: "Nigeria", currency: "NGN", code2: "ng" },
  { couCode: "PAK", couName: "Pakistan", currency: "PKR", code2: "pk" },
  { couCode: "BGD", couName: "Bangladesh", currency: "BDT", code2: "bd" },
  { couCode: "PHL", couName: "Philippines", currency: "PHP", code2: "ph" },
  {
    couCode: "ARE",
    couName: "United Arab Emirates",
    currency: "AED",
    code2: "ae",
  },
  { couCode: "GBR", couName: "United Kingdom", currency: "GBP", code2: "gb" },
  { couCode: "ZAF", couName: "South Africa", currency: "ZAR", code2: "za" },
];

const SAMPLE_RATES: Record<string, number> = {
  INR: 83.45,
  KES: 129.5,
  GHS: 15.85,
  TZS: 2540.0,
  UGX: 3720.0,
  NGN: 1550.0,
  PKR: 278.5,
  BDT: 110.25,
  PHP: 56.8,
  AED: 3.67,
  GBP: 0.79,
  ZAR: 18.25,
};

function formatAmount(amount: number, currency: string): string {
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ` ${currency}`
  );
}

export function RateCalculator() {
  const [amount, setAmount] = useState("1000");
  const [selectedCountry, setSelectedCountry] = useState(POPULAR_COUNTRIES[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const numericAmount = useMemo(() => {
    const parsed = parseFloat(amount.replace(/,/g, ""));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [amount]);

  const rate = SAMPLE_RATES[selectedCountry.currency] ?? 1;
  const receivedAmount = numericAmount * rate;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-rate-dropdown]")) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section id="rate-calculator" className="py-8 lg:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Check Live Rates
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            See exactly how much your recipient gets. Transparent pricing with
            no hidden fees.
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  You Send
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                      $
                    </span>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.,]/g, "");
                        setAmount(val);
                      }}
                      className="w-full h-14 pl-8 pr-4 text-xl font-semibold text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                      placeholder="1,000"
                    />
                  </div>
                  <div className="flex items-center gap-2 h-14 px-4 bg-slate-50 rounded-xl border border-slate-200">
                    <Image
                      src="https://flagcdn.com/w40/us.png"
                      alt="USA"
                      width={24}
                      height={18}
                      className="rounded-sm"
                      unoptimized
                    />
                    <span className="font-semibold text-slate-900">USD</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
                <div className="h-px flex-1 bg-slate-200" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 font-medium">
                  <RefreshCw className="w-3.5 h-3.5" />1 USD ={" "}
                  {rate.toLocaleString()} {selectedCountry.currency}
                </div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Recipient Gets
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <div className="w-full h-14 px-4 flex items-center text-xl font-semibold text-slate-900 rounded-xl bg-teal-50 border border-teal-200">
                      {formatAmount(receivedAmount, selectedCountry.currency)}
                    </div>
                  </div>
                  <div className="relative" data-rate-dropdown>
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="flex items-center gap-2 h-14 px-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors min-w-[140px]"
                    >
                      <Image
                        src={`https://flagcdn.com/w40/${selectedCountry.code2}.png`}
                        alt={selectedCountry.couName}
                        width={24}
                        height={18}
                        className="rounded-sm"
                        unoptimized
                      />
                      <span className="font-semibold text-slate-900">
                        {selectedCountry.currency}
                      </span>
                      <svg
                        className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {dropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-64 max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg z-10">
                        {POPULAR_COUNTRIES.map((country) => (
                          <button
                            key={country.couCode}
                            type="button"
                            onClick={() => {
                              setSelectedCountry(country);
                              setDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                              selectedCountry.couCode === country.couCode
                                ? "bg-teal-50 text-teal-700"
                                : "text-slate-700"
                            }`}
                          >
                            <Image
                              src={`https://flagcdn.com/w40/${country.code2}.png`}
                              alt={country.couName}
                              width={24}
                              height={18}
                              className="rounded-sm shrink-0"
                              unoptimized
                            />
                            <span className="flex-1 font-medium truncate">
                              {country.couName}
                            </span>
                            <span className="text-sm text-slate-500">
                              {country.currency}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 w-full h-14 text-base font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/25"
                >
                  Send Money Now
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>

              <p className="text-xs text-center text-slate-500">
                Rates shown are indicative. Final rates confirmed at transfer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
