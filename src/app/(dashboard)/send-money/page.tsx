"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { AddBeneficiaryModal } from "@/components/beneficiaries/AddBeneficiaryModal";
import {
  PhoneCountryInput,
  isValidE164Phone,
} from "@/components/PhoneCountryInput";
import Flag from "react-world-flags";
import countriesIso from "i18n-iso-countries";
import {
  ALPHA2_TO_CURRENCY,
  CURRENCY_TO_FLAG_ALPHA2,
} from "@/lib/send-money-currencies";
import {
  ChevronRight,
  Check,
  Loader2,
  ChevronDown,
  UserPlus,
} from "lucide-react";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function flexUrl(path: string) {
  return `${API_ROOT.replace(/\/$/, "")}/flex${path}`;
}

interface FlexCountry {
  couCode: string;
  couName: string;
}

interface SenderContext {
  senderCountryIso2: string | null;
  senderCountryName: string | null;
  defaultPayCurrency: string;
  payCurrencies: string[];
  canUseMobilePayIn: boolean;
  /** Comma-separated country names where mobile pay-in (e.g. M-Pesa) is supported */
  mobilePayInMarketsLabel: string;
}

interface Quote {
  fromCurrency: string;
  toCurrency: string;
  payAmount: number;
  rate: number;
  feeAmount: number;
  receiveAmount: number;
  quoteExpiresAt: string;
  indicative: boolean;
}

interface LookupOpt {
  value: string;
  label: string;
}

interface Beneficiary {
  id: string;
  deliveryChannel: "BANK_TRANSFER" | "MOBILE_MONEY";
  fullName: string;
  country?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  swiftBic?: string | null;
  mobileMoneyProvider?: string | null;
  mobileNumber?: string | null;
}

interface CompanyAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftBic?: string | null;
  iban?: string | null;
  currency: string;
  countryNote?: string | null;
  instructions?: string | null;
}

interface TransferRow {
  id: string;
  referenceCode: string;
  status: string;
  payCurrency?: string | null;
  payAmount?: unknown;
  receiveCurrency?: string | null;
  receiveAmount?: unknown;
  recipientCountryLabel?: string | null;
  payInMethod?: string | null;
  payerPhone?: string | null;
  beneficiary?: Beneficiary | null;
}

function alpha2FromCouCode(couCode: string): string | undefined {
  const u = couCode?.trim().toUpperCase();
  if (!u) return undefined;
  return countriesIso.alpha3ToAlpha2(u) || undefined;
}

function receiveCurrencyForCouCode(couCode: string): string {
  const a2 = alpha2FromCouCode(couCode);
  if (a2 && ALPHA2_TO_CURRENCY[a2]) return ALPHA2_TO_CURRENCY[a2];
  return "USD";
}

function maskAccount(n?: string | null) {
  if (!n || n.length < 4) return "····";
  return `····${n.slice(-4)}`;
}

function payCurrencyFlagCode(currency: string): string {
  return CURRENCY_TO_FLAG_ALPHA2[currency.toUpperCase()] ?? "US";
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const STEPS = [
  "Amount & corridor",
  "Beneficiary",
  "Compliance",
  "Paying from",
  "Review",
];

const SELECT_FIELD =
  "w-full border border-slate-200 rounded-lg px-3 h-10 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors";

/** Themed sample accounts when API list is empty (dev). */
const DUMMY_PAYOUT_ACCOUNTS: CompanyAccount[] = [
  {
    id: "dev-1",
    bankName: "Atlas Clearing Bank",
    accountName: "Remit2Globe Client Trust — USD",
    accountNumber: "8844-2910-7731-02",
    swiftBic: "ATLSUS6N",
    iban: null,
    currency: "USD",
    countryNote: "New York, USA",
    instructions:
      "Use your transfer reference in the payment narrative. Credits are applied after reconciliation.",
  },
  {
    id: "dev-2",
    bankName: "Meridian Global N.A.",
    accountName: "Remit2Globe Settlement",
    accountNumber: "GB12MIDL40051599881264",
    swiftBic: "MIDLGB22",
    iban: "GB12MIDL40051599881264",
    currency: "GBP",
    countryNote: "London, UK",
    instructions: "SWIFT / IBAN transfers only. Include reference code.",
  },
];

export default function SendMoneyPage() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [ctx, setCtx] = useState<SenderContext | null>(null);
  const [lookups, setLookups] = useState<{
    sourceOfIncome: LookupOpt[];
    transferPurpose: LookupOpt[];
    relationship: LookupOpt[];
  } | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [flexCountries, setFlexCountries] = useState<FlexCountry[]>([]);

  const [payCurrency, setPayCurrency] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [recipientCouCode, setRecipientCouCode] = useState("");
  const [recipientCouName, setRecipientCouName] = useState("");
  const [receiveCurrency, setReceiveCurrency] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [transferId, setTransferId] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [transferRow, setTransferRow] = useState<TransferRow | null>(null);

  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [selectedBen, setSelectedBen] = useState<Beneficiary | null>(null);
  const [sourceOfIncome, setSourceOfIncome] = useState("");
  const [transferPurpose, setTransferPurpose] = useState("");
  const [relationship, setRelationship] = useState("");

  const [payInMethod, setPayInMethod] = useState<
    "BANK_TRANSFER" | "MOBILE_MONEY" | ""
  >("");
  const [payerPhone, setPayerPhone] = useState("");
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>(
    [],
  );

  const [submitting, setSubmitting] = useState(false);
  const [postConfirmMessage, setPostConfirmMessage] = useState("");

  const [payCurrencyOpen, setPayCurrencyOpen] = useState(false);
  const [payCurrencySearch, setPayCurrencySearch] = useState("");
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");

  const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);

  const addBeneficiaryLock = useMemo(() => {
    const name = recipientCouName.trim();
    if (!name) return null;
    return {
      couName: recipientCouName.trim(),
      couCode: recipientCouCode.trim() || undefined,
    };
  }, [recipientCouName, recipientCouCode]);

  const dedupedFlexCountries = useMemo(() => {
    const byCode = new Map<string, FlexCountry>();
    for (const c of flexCountries) {
      if (!byCode.has(c.couCode)) byCode.set(c.couCode, c);
    }
    return [...byCode.values()];
  }, [flexCountries]);

  const filteredRecipientCountries = useMemo(() => {
    const q = recipientSearch.toLowerCase().trim();
    if (!q) return dedupedFlexCountries;
    return dedupedFlexCountries.filter(
      (c) =>
        c.couName.toLowerCase().includes(q) ||
        c.couCode.toLowerCase().includes(q),
    );
  }, [dedupedFlexCountries, recipientSearch]);

  const filteredPayCurrencyOptions = useMemo(() => {
    if (!ctx) return [] as string[];
    const q = payCurrencySearch.toLowerCase().trim();
    const list = ctx.payCurrencies;
    if (!q) return list;
    return list.filter((cur) => cur.toLowerCase().includes(q));
  }, [ctx, payCurrencySearch]);

  const recipientIso2 = useMemo(
    () => (recipientCouCode ? alpha2FromCouCode(recipientCouCode) : undefined),
    [recipientCouCode],
  );

  const filteredBeneficiaries = useMemo(() => {
    const r = recipientCouName.trim().toLowerCase();
    if (!r) return beneficiaries;
    return beneficiaries.filter(
      (b) => (b.country ?? "").trim().toLowerCase() === r,
    );
  }, [beneficiaries, recipientCouName]);

  const bankAccountsToShow = useMemo(() => {
    if (companyAccounts.length > 0) return companyAccounts;
    const cur = (payCurrency || "USD").toUpperCase();
    const match = DUMMY_PAYOUT_ACCOUNTS.filter((a) => a.currency === cur);
    return match.length > 0 ? match : DUMMY_PAYOUT_ACCOUNTS;
  }, [companyAccounts, payCurrency]);

  const complianceLabels = useMemo(() => {
    if (!lookups) return null;
    return {
      source:
        lookups.sourceOfIncome.find((o) => o.value === sourceOfIncome)
          ?.label ?? sourceOfIncome,
      purpose:
        lookups.transferPurpose.find((o) => o.value === transferPurpose)
          ?.label ?? transferPurpose,
      relationship:
        lookups.relationship.find((o) => o.value === relationship)?.label ??
        relationship,
    };
  }, [lookups, sourceOfIncome, transferPurpose, relationship]);

  useEffect(() => {
    if (step !== 4 || !ctx) return;
    if (!ctx.canUseMobilePayIn) {
      setPayInMethod("BANK_TRANSFER");
      return;
    }
    setPayInMethod((m) => m || "BANK_TRANSFER");
  }, [step, ctx]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ctxRes, lookRes, benRes, flexRes] = await Promise.all([
        api.get<{ data: SenderContext }>("/remittance/context"),
        api.get<{
          data: {
            sourceOfIncome: LookupOpt[];
            transferPurpose: LookupOpt[];
            relationship: LookupOpt[];
          };
        }>("/remittance/lookups"),
        api.get<{ data: { beneficiaries: Beneficiary[] } }>(
          "/beneficiaries",
        ),
        fetch(flexUrl("/countries"), { credentials: "include" }).then((r) =>
          r.json(),
        ),
      ]);
      const c = ctxRes.data.data;
      setCtx(c);
      setPayCurrency(c.defaultPayCurrency || c.payCurrencies[0] || "USD");
      setLookups(lookRes.data.data);
      setBeneficiaries(benRes.data.data.beneficiaries);
      const list = flexRes?.data?.data;
      setFlexCountries(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      setError("Could not load send-money data. Try again later.");
      console.error(e);
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!payCurrencyOpen && !recipientOpen) return;
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest("[data-pay-currency-dropdown]")) setPayCurrencyOpen(false);
      if (!el.closest("[data-recipient-country-dropdown]"))
        setRecipientOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [payCurrencyOpen, recipientOpen]);

  const refreshQuote = useCallback(async () => {
    const amt = parseFloat(payAmount);
    if (!payCurrency || !receiveCurrency || !amt || amt <= 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const { data } = await api.get<{ data: Quote }>("/remittance/quote", {
        params: {
          fromCurrency: payCurrency,
          toCurrency: receiveCurrency,
          payAmount: amt,
        },
      });
      setQuote(data.data);
      setError("");
    } catch {
      setQuote(null);
      setError(
        "No rate for this corridor yet. Try another currency pair or contact support.",
      );
    } finally {
      setQuoteLoading(false);
    }
  }, [payAmount, payCurrency, receiveCurrency]);

  useEffect(() => {
    if (!recipientCouCode) {
      setReceiveCurrency("");
      return;
    }
    setReceiveCurrency(receiveCurrencyForCouCode(recipientCouCode));
  }, [recipientCouCode]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshQuote();
    }, 400);
    return () => clearTimeout(t);
  }, [refreshQuote]);

  useEffect(() => {
    if (step !== 4 || payInMethod !== "BANK_TRANSFER" || !payCurrency) return;
    (async () => {
      try {
        const { data } = await api.get<{ data: { accounts: CompanyAccount[] } }>(
          "/remittance/company-accounts",
          { params: { currency: payCurrency } },
        );
        setCompanyAccounts(data.data.accounts);
      } catch {
        setCompanyAccounts([]);
      }
    })();
  }, [step, payInMethod, payCurrency]);

  async function handleStep1Next() {
    if (!quote || !ctx) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post<{ data: { transfer: TransferRow } }>(
        "/remittance/transfers",
        {
          senderCountryIso2: ctx.senderCountryIso2,
          payCurrency: quote.fromCurrency,
          payAmount: quote.payAmount,
          recipientCountryLabel: recipientCouName,
          recipientCountryIso2: recipientIso2 ?? null,
          receiveCurrency: quote.toCurrency,
          receiveAmount: quote.receiveAmount,
          fxRateSnapshot: quote.rate,
          feeAmount: quote.feeAmount,
          quoteExpiresAt: quote.quoteExpiresAt,
        },
      );
      setTransferId(data.data.transfer.id);
      setReferenceCode(data.data.transfer.referenceCode);
      setTransferRow(data.data.transfer);
      setStep(2);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to save";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2Next() {
    if (!transferId || !beneficiaryId) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.patch<{ data: { transfer: TransferRow } }>(
        `/remittance/transfers/${transferId}`,
        { step: 2, beneficiaryId },
      );
      setTransferRow(data.data.transfer);
      setStep(3);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep3Next() {
    if (!transferId) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.patch<{ data: { transfer: TransferRow } }>(
        `/remittance/transfers/${transferId}`,
        {
          step: 3,
          sourceOfIncome,
          transferPurpose,
          relationshipToRecipient: relationship,
        },
      );
      setTransferRow(data.data.transfer);
      setStep(4);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep4Next() {
    if (!transferId || !payInMethod) return;
    if (payInMethod === "MOBILE_MONEY") {
      if (!ctx?.canUseMobilePayIn) {
        setError("Mobile money pay-in is not available for your profile country.");
        return;
      }
      const p = payerPhone.trim();
      if (!p) {
        setError("Enter your mobile number with country code (e.g. +254712345678).");
        return;
      }
      if (!isValidE164Phone(p)) {
        setError(
          "Enter a valid mobile number for the selected country (check length and digits).",
        );
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.patch<{ data: { transfer: TransferRow } }>(
        `/remittance/transfers/${transferId}`,
        {
          step: 4,
          payInMethod,
          payerPhone:
            payInMethod === "MOBILE_MONEY" ? payerPhone.trim() : undefined,
        },
      );
      setTransferRow(data.data.transfer);
      setStep(5);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!transferId) return;
    setSubmitting(true);
    setError("");
    setPostConfirmMessage("");
    try {
      const res = await api.post<{
        data: { transfer: TransferRow };
        message?: string;
      }>(`/remittance/transfers/${transferId}/confirm`);
      setTransferRow(res.data.data.transfer);
      setReferenceCode(res.data.data.transfer.referenceCode);
      setPostConfirmMessage(
        typeof res.data.message === "string" ? res.data.message : "",
      );
      setStep(6);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setStep(1);
    setTransferId(null);
    setReferenceCode(null);
    setTransferRow(null);
    setSelectedBen(null);
    setBeneficiaryId("");
    setSourceOfIncome("");
    setTransferPurpose("");
    setRelationship("");
    setPayInMethod("");
    setPayerPhone("");
    setPostConfirmMessage("");
    setQuote(null);
    setPayAmount("");
    setRecipientCouCode("");
    setRecipientCouName("");
    if (ctx) setPayCurrency(ctx.defaultPayCurrency || "USD");
    setPayCurrencyOpen(false);
    setRecipientOpen(false);
    setPayCurrencySearch("");
    setRecipientSearch("");
    setShowAddBeneficiaryModal(false);
    setError("");
  }

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900">Send money</h1>
        <p className="text-sm text-slate-500 mt-1">
          Guided transfer — rates are indicative until payment is confirmed.
        </p>
      </div>

      {step < 6 && (
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center shrink-0">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                    active
                      ? "bg-teal-600 text-white border-teal-600"
                      : done
                        ? "bg-teal-50 text-teal-800 border-teal-200"
                        : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span>{n}</span>
                  )}
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {n < 5 && (
                  <ChevronRight className="w-4 h-4 text-slate-300 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Step 1 — calculator layout */}
      {step === 1 && ctx && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <p className="text-xs text-slate-500">
            Sending from your profile:{" "}
            <span className="font-medium text-slate-700">
              {ctx.senderCountryName ?? "—"}
              {ctx.senderCountryIso2 ? ` (${ctx.senderCountryIso2})` : ""}
            </span>
          </p>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              What you pay
            </h2>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <label className="sr-only" htmlFor="pay-amount">
                  Amount you pay
                </label>
                <input
                  id="pay-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={payAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    setPayAmount(v);
                  }}
                  placeholder="0"
                  className="w-full bg-transparent border-0 border-b-2 border-slate-200 pb-2 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight placeholder:text-slate-300 focus:outline-none focus:border-teal-600 transition-colors"
                />
              </div>
              <div className="relative shrink-0" data-pay-currency-dropdown>
                <button
                  type="button"
                  onClick={() => {
                    setPayCurrencyOpen((o) => !o);
                    setPayCurrencySearch("");
                    setRecipientOpen(false);
                  }}
                  className="flex items-center gap-2 h-11 sm:h-12 pl-2.5 pr-2 min-w-[7rem] rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-50 text-left transition-colors"
                >
                  <span className="inline-flex h-8 w-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                    <Flag
                      code={payCurrencyFlagCode(payCurrency || "USD")}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {payCurrency || "—"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                </button>
                {payCurrencyOpen && (
                  <div className="absolute z-50 right-0 mt-1 w-[min(100vw-2rem,16rem)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        autoFocus
                        placeholder="Search currency…"
                        value={payCurrencySearch}
                        onChange={(e) => setPayCurrencySearch(e.target.value)}
                        className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                      />
                    </div>
                    <ul className="max-h-52 overflow-y-auto py-1">
                      {filteredPayCurrencyOptions.map((cur) => (
                        <li key={cur}>
                          <button
                            type="button"
                            onClick={() => {
                              setPayCurrency(cur);
                              setPayCurrencyOpen(false);
                            }}
                            className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-teal-50 ${
                              payCurrency === cur
                                ? "bg-teal-50 text-teal-800 font-medium"
                                : "text-slate-700"
                            }`}
                          >
                            <Flag
                              code={payCurrencyFlagCode(cur)}
                              className="w-6 h-4 rounded object-cover"
                            />
                            <span className="font-semibold">{cur}</span>
                          </button>
                        </li>
                      ))}
                      {filteredPayCurrencyOptions.length === 0 && (
                        <li className="px-3 py-3 text-sm text-slate-400 text-center">
                          No match
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end min-h-[2rem] items-center">
            {quoteLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            ) : quote ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50/90 pl-1.5 pr-2.5 py-1 border border-slate-100 shadow-sm">
                <span className="inline-flex h-7 w-7 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                  <Flag
                    code={payCurrencyFlagCode(quote.fromCurrency)}
                    className="h-full w-full object-cover"
                  />
                </span>
                <p className="text-sm text-slate-700 tabular-nums">
                  <span className="font-semibold text-slate-800">
                    1 {quote.fromCurrency}
                  </span>
                  <span className="text-slate-400 mx-1">=</span>
                  <span className="font-semibold text-slate-800">
                    {fmtMoney(quote.rate)} {quote.toCurrency}
                  </span>
                </p>
                <span className="inline-flex h-7 w-7 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                  <Flag
                    code={payCurrencyFlagCode(quote.toCurrency)}
                    className="h-full w-full object-cover"
                  />
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-right">
                Enter amount and recipient to see rate
              </p>
            )}
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              What they get
            </h2>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
              <div className="flex-1 min-w-0 border-b-2 border-slate-200 pb-2">
                <span className="sr-only">Recipient receives</span>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums tracking-tight min-h-[2.5rem]">
                  {quote ? fmtMoney(Number(quote.receiveAmount)) : "—"}
                </p>
              </div>
              <div className="relative shrink-0" data-recipient-country-dropdown>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientOpen((o) => !o);
                    setRecipientSearch("");
                    setPayCurrencyOpen(false);
                  }}
                  className="flex items-center gap-2 h-11 sm:h-12 pl-2.5 pr-2 min-w-[10rem] rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-50 text-left transition-colors"
                >
                  {recipientIso2 ? (
                    <span className="inline-flex h-8 w-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm shrink-0">
                      <Flag
                        code={recipientIso2}
                        className="h-full w-full object-cover"
                      />
                    </span>
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-slate-200 shrink-0 ring-2 ring-white" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-bold text-slate-900 leading-tight truncate max-w-[8rem] sm:max-w-[10rem]">
                      {receiveCurrency || "—"}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[8rem] sm:max-w-[10rem]">
                      {recipientCouName || "Country"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                </button>
                {recipientOpen && (
                  <div className="absolute z-50 right-0 mt-1 w-[min(100vw-2rem,20rem)] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        autoFocus
                        placeholder="Search country…"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                      />
                    </div>
                    <ul className="max-h-60 overflow-y-auto py-1">
                      {filteredRecipientCountries.map((c) => {
                        const a2 = alpha2FromCouCode(c.couCode);
                        return (
                          <li key={c.couCode}>
                            <button
                              type="button"
                              onClick={() => {
                                setRecipientCouCode(c.couCode);
                                setRecipientCouName(c.couName);
                                setRecipientOpen(false);
                              }}
                              className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-teal-50 hover:text-teal-800 transition-colors ${
                                recipientCouCode === c.couCode
                                  ? "bg-teal-50 text-teal-800 font-medium"
                                  : "text-slate-700"
                              }`}
                            >
                              {a2 ? (
                                <Flag
                                  code={a2}
                                  className="w-6 h-4 rounded object-cover shrink-0"
                                />
                              ) : (
                                <span className="w-6 h-4 rounded bg-slate-200 text-[8px] flex items-center justify-center font-bold text-slate-500">
                                  {c.couCode.slice(0, 2)}
                                </span>
                              )}
                              <span className="truncate">{c.couName}</span>
                            </button>
                          </li>
                        );
                      })}
                      {filteredRecipientCountries.length === 0 && (
                        <li className="px-3 py-4 text-sm text-slate-400 text-center">
                          No countries found
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 pt-1 border-t border-slate-100">
            {quote
              ? `Fees applicable ${fmtMoney(Number(quote.feeAmount))} ${quote.toCurrency}`
              : "Fees will appear when a quote is available."}
          </p>

          <button
            type="button"
            disabled={
              submitting ||
              !quote ||
              !recipientCouName ||
              !parseFloat(payAmount)
            }
            onClick={() => void handleStep1Next()}
            className="w-full h-12 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Continue to beneficiary
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-slate-600 sm:pt-0.5">
              Choose a beneficiary in{" "}
              <strong>{recipientCouName || "this country"}</strong>.
            </p>
            <button
              type="button"
              disabled={!recipientCouName.trim()}
              title={
                recipientCouName.trim()
                  ? undefined
                  : "Choose a recipient country first"
              }
              onClick={() => {
                if (!recipientCouName.trim()) {
                  setError("Choose a recipient country before adding a beneficiary.");
                  return;
                }
                setError("");
                setShowAddBeneficiaryModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 h-10 shrink-0 px-4 rounded-lg border border-teal-200 bg-teal-50/70 text-teal-900 text-sm font-medium hover:bg-teal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              Add new beneficiary
            </button>
          </div>
          {filteredBeneficiaries.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50/90 border border-amber-100 rounded-lg p-3">
              No saved beneficiaries match this country yet. Use{" "}
              <span className="font-semibold">Add new beneficiary</span> to
              add one in the form that opens here; you stay on Send money and
              the new recipient appears in this list when it is saved.
            </p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {filteredBeneficiaries.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setBeneficiaryId(b.id);
                      setSelectedBen(b);
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                      beneficiaryId === b.id
                        ? "border-teal-600 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {b.fullName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      {b.country && (
                        <>
                          <span className="inline-flex items-center gap-1">
                            {(() => {
                              const fc = flexCountries.find(
                                (x) =>
                                  x.couName.trim().toLowerCase() ===
                                  (b.country ?? "").trim().toLowerCase(),
                              );
                              const a2 = fc
                                ? alpha2FromCouCode(fc.couCode)
                                : undefined;
                              return a2 ? (
                                <Flag
                                  code={a2}
                                  className="w-5 h-3.5 rounded object-cover"
                                />
                              ) : null;
                            })()}
                            {b.country}
                          </span>
                          <span>·</span>
                        </>
                      )}
                      {b.deliveryChannel === "BANK_TRANSFER" ? (
                        <span>
                          {b.bankName} · {maskAccount(b.accountNumber)}
                        </span>
                      ) : (
                        <span>
                          {b.mobileMoneyProvider} · {b.mobileNumber}
                        </span>
                      )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!beneficiaryId || submitting}
              onClick={() => void handleStep2Next()}
              className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && lookups && (
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Source of income
            </label>
            <select
              value={sourceOfIncome}
              onChange={(e) => setSourceOfIncome(e.target.value)}
              className={SELECT_FIELD}
            >
              <option value="">Select…</option>
              {lookups.sourceOfIncome.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Purpose of transfer
            </label>
            <select
              value={transferPurpose}
              onChange={(e) => setTransferPurpose(e.target.value)}
              className={SELECT_FIELD}
            >
              <option value="">Select…</option>
              {lookups.transferPurpose.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Relationship to recipient
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className={SELECT_FIELD}
            >
              <option value="">Select…</option>
              {lookups.relationship.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                submitting ||
                !sourceOfIncome ||
                !transferPurpose ||
                !relationship
              }
              onClick={() => void handleStep3Next()}
              className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && ctx && (
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-800">Paying from</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Choose how you will send funds to us. This is separate from how
              your beneficiary receives the money (bank vs mobile wallet on
              their side).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPayInMethod("BANK_TRANSFER")}
              className={`h-10 px-4 rounded-lg text-sm border ${
                payInMethod === "BANK_TRANSFER"
                  ? "bg-teal-600 text-white border-teal-600"
                  : "border-slate-200"
              }`}
            >
              Bank transfer
            </button>
            {ctx.canUseMobilePayIn ? (
              <button
                type="button"
                onClick={() => setPayInMethod("MOBILE_MONEY")}
                className={`h-10 px-4 rounded-lg text-sm border ${
                  payInMethod === "MOBILE_MONEY"
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-slate-200"
                }`}
              >
                Mobile money
              </button>
            ) : (
              <div className="flex-1 min-w-[12rem] rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">
                  Mobile money pay-in
                </span>{" "}
                is only available when your profile country is in a supported
                market (e.g.{" "}
                {ctx.mobilePayInMarketsLabel || "Kenya, Tanzania, Uganda"}).
                Your profile:{" "}
                <span className="font-medium text-slate-800">
                  {ctx.senderCountryName ?? "—"}
                  {ctx.senderCountryIso2 ? ` (${ctx.senderCountryIso2})` : ""}
                </span>
                . Everyone can use <strong>Bank transfer</strong>.
              </div>
            )}
          </div>

          {payInMethod === "BANK_TRANSFER" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Transfer to one of our accounts using your banking app. Use your
                reference on the next screen in the payment description.
              </p>
              <div className="space-y-3">
                {bankAccountsToShow.map((a) => (
                  <div
                    key={a.id}
                    className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-teal-50/30 p-4 shadow-sm ring-1 ring-slate-100"
                  >
                    <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-teal-500/10" />
                    <div className="relative flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-700/90">
                          Pay into
                        </p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">
                          {a.bankName}
                        </p>
                        {a.countryNote && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {a.countryNote}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-600/10 text-teal-800 border border-teal-200/60">
                        {a.currency}
                      </span>
                    </div>
                    <div className="relative mt-3 space-y-2 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Account name
                        </p>
                        <p className="text-slate-800 font-medium">{a.accountName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Account number
                        </p>
                        <p className="font-mono text-sm font-semibold text-slate-900 tracking-wide">
                          {a.accountNumber}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {a.swiftBic && (
                          <span>
                            <span className="text-slate-400">SWIFT</span>{" "}
                            <span className="font-mono font-medium text-slate-800">
                              {a.swiftBic}
                            </span>
                          </span>
                        )}
                        {a.iban && (
                          <span>
                            <span className="text-slate-400">IBAN</span>{" "}
                            <span className="font-mono font-medium text-slate-800">
                              {a.iban}
                            </span>
                          </span>
                        )}
                      </div>
                      {a.instructions && (
                        <p className="text-xs text-slate-500 pt-1 border-t border-slate-100 mt-2">
                          {a.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payInMethod === "MOBILE_MONEY" && ctx.canUseMobilePayIn && (
            <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50/40 p-4">
              <label
                className="text-sm font-medium text-slate-800 block mb-1"
                htmlFor="payer-phone-send-money"
              >
                Your mobile number
              </label>
              <PhoneCountryInput
                key={`payer-phone-${transferId ?? "new"}-${payInMethod}`}
                id="payer-phone-send-money"
                value={payerPhone}
                onChange={setPayerPhone}
                disabled={submitting}
                defaultIso2={ctx.senderCountryIso2}
                hint={
                  <>
                    Search and pick your country code (same as on registration),
                    then enter your number without the leading zero. We use this
                    for an <strong>STK / mobile money collection</strong> for the
                    amount you send. After you confirm on the next step, the
                    push runs (sandbox: simulated). You may need to upload
                    payment confirmation for our team afterward.
                  </>
                }
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(3)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                !payInMethod ||
                submitting ||
                (payInMethod === "MOBILE_MONEY" &&
                  !isValidE164Phone(payerPhone))
              }
              onClick={() => void handleStep4Next()}
              className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Step 5 */}
      {step === 5 && quote && selectedBen && (
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-sm">
          <h2 className="font-semibold text-slate-900">Summary</h2>
          <p className="text-xs text-slate-500">
            Review everything below. After you proceed, payment steps depend on
            whether you pay by bank or mobile money.
          </p>

          <dl className="space-y-3 divide-y divide-slate-100">
            <div className="pt-1 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Amounts
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">You pay</dt>
                <dd className="font-medium text-right">
                  {fmtMoney(Number(quote.payAmount))} {quote.fromCurrency}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Recipient gets</dt>
                <dd className="font-medium text-teal-700 text-right">
                  {fmtMoney(Number(quote.receiveAmount))} {quote.toCurrency}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Fees</dt>
                <dd className="text-right">
                  {fmtMoney(Number(quote.feeAmount))} {quote.toCurrency}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Rate</dt>
                <dd className="text-right tabular-nums">
                  1 {quote.fromCurrency} = {fmtMoney(quote.rate)}{" "}
                  {quote.toCurrency}
                </dd>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Corridor and reference
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Paying to (country)</dt>
                <dd className="font-medium text-right">{recipientCouName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Transfer reference</dt>
                <dd className="font-mono text-xs font-semibold text-teal-800 text-right break-all">
                  {referenceCode ?? transferRow?.referenceCode ?? "—"}
                </dd>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Recipient (payout)
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Beneficiary</dt>
                <dd className="font-medium text-right">{selectedBen.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Delivery channel</dt>
                <dd className="text-right">
                  {selectedBen.deliveryChannel === "BANK_TRANSFER"
                    ? "Bank transfer"
                    : "Mobile money"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 items-start">
                <dt className="text-slate-500 shrink-0">Payout account</dt>
                <dd className="text-right max-w-[65%] text-slate-800">
                  {selectedBen.deliveryChannel === "BANK_TRANSFER" ? (
                    <>
                      {selectedBen.bankName}
                      <span className="block text-xs text-slate-500 mt-0.5 font-mono">
                        {selectedBen.accountNumber
                          ? maskAccount(selectedBen.accountNumber)
                          : "—"}
                      </span>
                    </>
                  ) : (
                    <>
                      {selectedBen.mobileMoneyProvider ?? "—"}
                      <span className="block text-xs text-slate-500 mt-0.5 font-mono">
                        {selectedBen.mobileNumber ?? "—"}
                      </span>
                    </>
                  )}
                </dd>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Compliance
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Source of income</dt>
                <dd className="text-right">{complianceLabels?.source ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Transfer purpose</dt>
                <dd className="text-right">{complianceLabels?.purpose ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Relationship</dt>
                <dd className="text-right">
                  {complianceLabels?.relationship ?? "—"}
                </dd>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                How you pay us
              </p>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 shrink-0">Paying from</dt>
                <dd className="font-medium text-right">
                  {payInMethod === "MOBILE_MONEY"
                    ? "Mobile money (STK / collection)"
                    : "Bank transfer"}
                </dd>
              </div>
              {payInMethod === "MOBILE_MONEY" && (
                <div className="flex justify-between gap-4 items-start">
                  <dt className="text-slate-500 shrink-0">Your phone</dt>
                  <dd className="font-mono text-xs text-right break-all">
                    {payerPhone.trim()}
                  </dd>
                </div>
              )}
              {payInMethod === "BANK_TRANSFER" && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  Use the company account details from the previous step in your
                  banking app. Include the transfer reference in the payment
                  narrative.
                </p>
              )}
            </div>
          </dl>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              className="flex-1 h-10 border border-slate-200 rounded-lg text-sm"
              onClick={() => setStep(4)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleConfirm()}
              className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Proceed
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {step === 6 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-teal-50 flex items-center justify-center">
            <Check className="w-7 h-7 text-teal-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            Transfer submitted
          </h2>
          <p className="text-sm text-slate-600">
            Reference:{" "}
            <span className="font-mono font-bold text-teal-700">
              {referenceCode}
            </span>
          </p>
          {postConfirmMessage ? (
            <p className="text-sm text-slate-700 max-w-lg mx-auto leading-relaxed">
              {postConfirmMessage}
            </p>
          ) : null}
          {payInMethod === "MOBILE_MONEY" || transferRow?.payInMethod === "MOBILE_MONEY" ? (
            <div className="text-left max-w-lg mx-auto space-y-3 text-xs text-slate-600 border border-teal-100 rounded-lg p-4 bg-teal-50/30">
              <p className="font-semibold text-slate-800 text-sm">
                Mobile money — what happens next
              </p>
              <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                <li>
                  <strong>STK push:</strong> We initiate a collection request to{" "}
                  <span className="font-mono">
                    {payerPhone.trim() ||
                      transferRow?.payerPhone ||
                      "—"}
                  </span>
                  . Approve the prompt on your phone when it appears (sandbox:
                  not connected to a live provider yet).
                </li>
                <li>
                  <strong>Pending → processing:</strong> Your transfer stays in{" "}
                  <strong>PENDING_PAYMENT</strong> until we confirm funds.
                </li>
                <li>
                  <strong>Receipt and proof:</strong> Keep your mobile-money
                  confirmation. Upload payment proof for our team to review so we
                  can complete compliance and payout.
                </li>
                <li>
                  After review, we process the payout to your beneficiary according
                  to the delivery channel you chose.
                </li>
              </ol>
            </div>
          ) : (
            <div className="text-left max-w-lg mx-auto space-y-3 text-xs text-slate-600 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <p className="font-semibold text-slate-800 text-sm">
                Bank transfer — what happens next
              </p>
              <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                <li>
                  Pay the amount using your bank app to one of our company
                  accounts (see the previous step). Always include reference{" "}
                  <span className="font-mono font-medium text-teal-800">
                    {referenceCode}
                  </span>{" "}
                  in the payment description.
                </li>
                <li>
                  <strong>Admin review:</strong> Our team reconciles incoming
                  transfers. Upload bank payment proof when asked so we can match
                  your payment faster.
                </li>
                <li>
                  After admin approval, we send the funds to your beneficiary using
                  the payout details from your transfer.
                </li>
              </ol>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Status: <strong>PENDING_PAYMENT</strong>
          </p>
          <button
            type="button"
            onClick={resetFlow}
            className="h-10 px-6 bg-slate-900 text-white rounded-lg text-sm font-medium"
          >
            New transfer
          </button>
        </div>
      )}

      <AddBeneficiaryModal
        open={showAddBeneficiaryModal}
        onClose={() => setShowAddBeneficiaryModal(false)}
        lockCountry={addBeneficiaryLock}
        onSuccess={async (created) => {
          try {
            const benRes = await api.get<{
              data: { beneficiaries: Beneficiary[] };
            }>("/beneficiaries");
            const list = benRes.data.data.beneficiaries;
            setBeneficiaries(list);
            const row = list.find((x) => x.id === created.id);
            if (row) {
              setBeneficiaryId(row.id);
              setSelectedBen(row);
            }
          } catch {
            /* ignore */
          }
        }}
      />
    </div>
  );
}
