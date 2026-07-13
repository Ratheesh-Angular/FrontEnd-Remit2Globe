"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Flag from "react-world-flags";
import { ArrowRight } from "lucide-react";
import { RecipientCurrencySelect } from "@/components/remittance/RecipientCurrencySelect";
import { Loader } from "@/components/ui/Loader";
import { useCatalogCountries } from "@/hooks/useCatalogCountries";
import { resolveFlexExchangeRate } from "@/lib/flex-forex-rate";
import {
  buildRecipientCurrencyOptions,
  fmtFxRate,
  payCurrencyFlagCode,
  type RecipientReceiveOption,
} from "@/lib/send-money-currencies";
import { useLandingCountry } from "@/components/landing/LandingCountryContext";

function sanitizeAmountInput(raw: string): string {
  return raw.replace(/[^0-9.,]/g, "");
}

function parseAmount(raw: string): number {
  const parsed = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatDerivedAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function RateCalculator({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  const { payCurrency, setPayCurrency, payCurrencyOptions } = useLandingCountry();
  const { countries: catalogCountries, loading: catalogLoading } =
    useCatalogCountries(true);

  const recipientCurrencyOptions = useMemo(
    () => buildRecipientCurrencyOptions(catalogCountries),
    [catalogCountries],
  );

  const defaultReceiveOption = useMemo(() => {
    return (
      recipientCurrencyOptions.find((o) => o.currency === "INR") ??
      recipientCurrencyOptions[0] ??
      null
    );
  }, [recipientCurrencyOptions]);

  const [receiveOption, setReceiveOption] =
    useState<RecipientReceiveOption | null>(null);
  const [payAmount, setPayAmount] = useState("1000");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [amountEditSide, setAmountEditSide] = useState<"pay" | "receive">("pay");
  const [flexForexRate, setFlexForexRate] = useState<number | null>(null);
  const [flexForexLoading, setFlexForexLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    if (!receiveOption && defaultReceiveOption) {
      setReceiveOption(defaultReceiveOption);
    }
  }, [defaultReceiveOption, receiveOption]);

  const receiveCurrency = receiveOption?.currency ?? "";

  const refreshFlexForexRate = useCallback(async () => {
    if (!receiveCurrency.trim()) {
      setFlexForexRate(null);
      setRateError(null);
      return;
    }
    setFlexForexLoading(true);
    setRateError(null);
    setFlexForexRate(null);
    try {
      const rate = await resolveFlexExchangeRate(payCurrency, receiveCurrency);
      setFlexForexRate(rate);
    } catch {
      setFlexForexRate(null);
      setRateError("Could not load exchange rate for this currency pair.");
    } finally {
      setFlexForexLoading(false);
    }
  }, [receiveCurrency, payCurrency]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshFlexForexRate();
    }, 300);
    return () => clearTimeout(t);
  }, [refreshFlexForexRate]);

  /** Keep the non-edited side in sync from live Flex rates (same pattern as send-money). */
  useEffect(() => {
    if (flexForexLoading) return;

    if (amountEditSide === "pay") {
      const pay = parseAmount(payAmount);
      if (!pay || flexForexRate == null) {
        if (!pay) setReceiveAmount("");
        return;
      }
      setReceiveAmount(formatDerivedAmount(pay * flexForexRate));
      return;
    }

    const recv = parseAmount(receiveAmount);
    if (!recv || flexForexRate == null) {
      if (!recv) setPayAmount("");
      return;
    }
    setPayAmount(formatDerivedAmount(recv / flexForexRate));
  }, [
    amountEditSide,
    payAmount,
    receiveAmount,
    flexForexRate,
    flexForexLoading,
  ]);

  const rateDisplayForward = amountEditSide === "pay";
  const displayedFromCurrency = rateDisplayForward
    ? payCurrency
    : receiveCurrency;
  const displayedToCurrency = rateDisplayForward
    ? receiveCurrency
    : payCurrency;
  const displayedFxRate = flexForexRate;
  const rateDisplayLoading =
    flexForexLoading &&
    (rateDisplayForward ? !!parseAmount(payAmount) : !!parseAmount(receiveAmount));

  const isCompact = variant === "compact";
  const inputHeight = isCompact ? "h-12" : "h-14";
  const inputText = isCompact ? "text-lg" : "text-xl";
  const ctaHeight = isCompact ? "h-12" : "h-14";
  const cardPadding = isCompact ? "p-5 sm:p-6" : "p-6 sm:p-8";
  const cardShadow = isCompact
    ? "shadow-lg shadow-slate-200/40"
    : "shadow-xl shadow-slate-200/50";

  const calculatorCard = (
    <div
      className={`bg-white rounded-2xl border border-slate-200 ${cardShadow} ${cardPadding}`}
    >
      <div className={isCompact ? "space-y-5" : "space-y-6"}>
        <div>
          <label
            htmlFor="landing-pay-amount"
            className="text-sm font-medium text-slate-700 mb-2 block"
          >
            What you pay
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                id="landing-pay-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={payAmount}
                onChange={(e) => {
                  setAmountEditSide("pay");
                  setPayAmount(sanitizeAmountInput(e.target.value));
                }}
                className={`w-full ${inputHeight} px-4 ${inputText} font-semibold text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600`}
                placeholder="1,000"
              />
            </div>
            <div
              className={`flex ${inputHeight} shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-1`}
            >
              {payCurrencyOptions.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => {
                    setPayCurrency(currency);
                    setAmountEditSide("pay");
                  }}
                  className={`inline-flex items-center gap-1.5 h-full px-3 rounded-lg text-sm font-semibold transition-colors ${
                    payCurrency === currency
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Flag
                    code={payCurrencyFlagCode(currency)}
                    className="w-5 h-3.5 rounded-sm object-cover"
                  />
                  {currency}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-center min-h-[2rem] items-center">
          {rateDisplayLoading ? (
            <Loader variant="inline" label="Loading rate…" />
          ) : displayedFxRate != null &&
            displayedFromCurrency &&
            displayedToCurrency ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50/90 pl-1.5 pr-2.5 py-1 border border-slate-100 shadow-sm">
              <span className="inline-flex h-7 w-7 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                <Flag
                  code={payCurrencyFlagCode(displayedFromCurrency)}
                  className="h-full w-full object-cover"
                />
              </span>
              <p className="text-sm text-slate-700 tabular-nums">
                <span className="font-semibold text-slate-800">
                  1 {displayedFromCurrency}
                </span>
                <span className="text-slate-400 mx-1">=</span>
                <span className="font-semibold text-slate-800">
                  {fmtFxRate(displayedFxRate)} {displayedToCurrency}
                </span>
              </p>
              <span className="inline-flex h-7 w-7 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                <Flag
                  code={payCurrencyFlagCode(displayedToCurrency)}
                  className="h-full w-full object-cover"
                />
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center">
              {rateError ??
                (catalogLoading
                  ? "Loading supported currencies…"
                  : "Select a receive currency to see rate")}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="landing-receive-amount"
            className="text-sm font-medium text-slate-700 mb-2 block"
          >
            Recipient Gets
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <input
                id="landing-receive-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={receiveAmount}
                onChange={(e) => {
                  setAmountEditSide("receive");
                  setReceiveAmount(sanitizeAmountInput(e.target.value));
                }}
                placeholder="0"
                className={`w-full ${inputHeight} px-4 ${inputText} font-semibold text-slate-900 rounded-xl bg-red-50 border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600`}
              />
            </div>
            <RecipientCurrencySelect
              value={receiveCurrency}
              options={recipientCurrencyOptions}
              loading={catalogLoading}
              disabled={
                catalogLoading || recipientCurrencyOptions.length === 0
              }
              onChange={(opt) => {
                setReceiveOption(opt);
                setAmountEditSide("pay");
              }}
            />
          </div>
        </div>

        <div className={isCompact ? "pt-2" : "pt-4"}>
          <Link
            href="/register"
            className={`flex items-center justify-center gap-2 w-full ${ctaHeight} text-base font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/25`}
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
  );

  if (isCompact) {
    return (
      <div className="w-full">
        <div className="text-center mb-6 lg:hidden">
          <h2 className="text-xl font-bold text-slate-900">Check Live Rates</h2>
          <p className="mt-2 text-sm text-slate-600">
            See exactly how much your recipient gets.
          </p>
        </div>
        {calculatorCard}
      </div>
    );
  }

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

        <div className="max-w-xl mx-auto">{calculatorCard}</div>
      </div>
    </section>
  );
}
