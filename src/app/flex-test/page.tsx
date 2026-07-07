"use client";

import { useMemo, useState } from "react";
import { flexApiUrl } from "@/lib/flex-api";

type TabId = "general" | "ifsc" | "forex";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General API" },
  { id: "ifsc", label: "IFSC Validate" },
  { id: "forex", label: "Forex Rate" },
];

const FOREX_PRESETS = [
  { label: "USD → KES", from: "USD", to: "KES" },
  { label: "USD → INR", from: "USD", to: "INR" },
  { label: "USD → NGN", from: "USD", to: "NGN" },
  { label: "USD → GHS", from: "USD", to: "GHS" },
  { label: "GBP → KES", from: "GBP", to: "KES" },
  { label: "EUR → KES", from: "EUR", to: "KES" },
];

const FROM_CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD"];
const TO_CURRENCIES = [
  "KES",
  "INR",
  "NGN",
  "GHS",
  "UGX",
  "TZS",
  "PKR",
  "BDT",
  "PHP",
  "ZAR",
];

function JsonBlock({ value }: { value: unknown }) {
  if (value == null) return null;
  return (
    <pre className="mt-4 rounded-lg bg-slate-950 text-emerald-400 text-xs sm:text-sm p-4 overflow-auto max-h-[480px] border border-slate-800">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function FlexTestPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const [ifscCode, setIfscCode] = useState("");
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscResult, setIfscResult] = useState<unknown>(null);

  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("KES");
  const [currPairOverride, setCurrPairOverride] = useState("");
  const [forexLoading, setForexLoading] = useState(false);
  const [forexResult, setForexResult] = useState<unknown>(null);

  const resolvedCurrPair = useMemo(() => {
    if (currPairOverride.trim()) return currPairOverride.trim();
    return `${fromCurrency} - ${toCurrency}`;
  }, [currPairOverride, fromCurrency, toCurrency]);

  const countryOptions = useMemo(() => {
    if (!response || typeof response !== "object" || response === null) return [];
    const data = (response as { data?: { data?: unknown } }).data;
    if (!data || typeof data !== "object" || !Array.isArray((data as { data?: unknown }).data)) {
      return [];
    }
    return (data as { data: { couCode: string; couName: string }[] }).data;
  }, [response]);

  const callAPI = async (endpoint: string) => {
    try {
      setLoading(true);
      const res = await fetch(flexApiUrl(endpoint), { credentials: "include" });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      console.error(err);
      setResponse({ error: "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  const getBanks = async (couCode: string) => {
    try {
      const res = await fetch(flexApiUrl(`/banks/${couCode}`), {
        credentials: "include",
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      console.error(err);
      setResponse({ error: "Request failed" });
    }
  };

  const handleGetBanks = (couCode: string) => {
    if (couCode) getBanks(couCode);
  };

  const validateIfsc = async () => {
    const trimmed = ifscCode.trim().toUpperCase();
    if (!trimmed) {
      setIfscResult({ success: false, error: "Enter an IFSC code" });
      return;
    }

    try {
      setIfscLoading(true);
      const res = await fetch(flexApiUrl("/ifsc-validate"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "IFSC", payload: trimmed }),
      });
      const data = await res.json().catch(() => ({ error: "Invalid JSON" }));
      setIfscResult({ httpStatus: res.status, ...data });
    } catch (err) {
      console.error(err);
      setIfscResult({ success: false, error: "Request failed" });
    } finally {
      setIfscLoading(false);
    }
  };

  const fetchForexRate = async () => {
    const currPair = resolvedCurrPair.trim();
    if (!currPair) {
      setForexResult({ success: false, error: "Enter a currency pair" });
      return;
    }

    try {
      setForexLoading(true);
      const res = await fetch(flexApiUrl("/forex-rate"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currPair }),
      });
      const data = await res.json().catch(() => ({ error: "Invalid JSON" }));
      setForexResult({ httpStatus: res.status, ...data });
    } catch (err) {
      console.error(err);
      setForexResult({ success: false, error: "Request failed" });
    } finally {
      setForexLoading(false);
    }
  };

  const applyForexPreset = (from: string, to: string) => {
    setCurrPairOverride("");
    setFromCurrency(from);
    setToCurrency(to);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Flex API Test Panel
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sandbox tools for Flex endpoints via our backend proxy (
            <code className="text-teal-700">/api/flex/*</code>).
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-teal-700 border border-slate-200 border-b-white -mb-px"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 sm:p-6">
          {activeTab === "general" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">General Flex API</h2>

              <div className="flex flex-wrap gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => callAPI("/token")}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Get Token
                </button>
                <button
                  type="button"
                  onClick={() => callAPI("/md5")}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  Generate MD5
                </button>
                <button
                  type="button"
                  onClick={() => callAPI("/test")}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
                >
                  Test Protected API
                </button>
                <button
                  type="button"
                  onClick={() => callAPI("/countries")}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
                >
                  Get Countries
                </button>
              </div>

              {loading && <p className="text-sm text-slate-500 mb-3">Loading…</p>}

              {countryOptions.length > 0 && (
                  <div className="mb-5">
                    <label className="text-sm font-medium text-slate-700">
                      Select country for banks
                    </label>
                    <select
                      className="mt-1.5 block w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      onChange={(e) => handleGetBanks(e.target.value)}
                      defaultValue=""
                    >
                      <option value="">— Select country —</option>
                      {countryOptions.map((country) => (
                        <option key={country.couCode} value={country.couCode}>
                          {country.couName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              <JsonBlock value={response} />
            </div>
          )}

          {activeTab === "ifsc" && (
            <div>
              <h2 className="text-lg font-semibold mb-2">IFSC validate (Flex)</h2>
              <p className="text-sm text-slate-600 mb-4">
                POSTs to our backend; server calls Flex{" "}
                <code className="text-teal-700">/ifscValidate</code> with{" "}
                <code className="text-teal-700">
                  {`{ "type": "IFSC", "payload": "SBIN0001234" }`}
                </code>
                .
              </p>

              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  placeholder="e.g. HDFC0000123"
                  maxLength={11}
                  className="min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
                />
                <button
                  type="button"
                  onClick={validateIfsc}
                  disabled={ifscLoading}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  {ifscLoading ? "Validating…" : "Validate IFSC"}
                </button>
              </div>

              <JsonBlock value={ifscResult} />
            </div>
          )}

          {activeTab === "forex" && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Forex rate (Flex)</h2>
              <p className="text-sm text-slate-600 mb-4">
                POSTs to our backend; server calls Flex{" "}
                <code className="text-teal-700">/forexRate</code> with signed
                headers (Bearer token, x-userId, x-password, x-timestamp) and
                body{" "}
                <code className="text-teal-700">
                  {`{ "currPair": "USD - KES" }`}
                </code>
                .
              </p>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">
                  Quick presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {FOREX_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyForexPreset(preset.from, preset.to)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 bg-white hover:border-teal-300 hover:text-teal-700"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    From currency
                  </label>
                  <select
                    value={fromCurrency}
                    onChange={(e) => {
                      setCurrPairOverride("");
                      setFromCurrency(e.target.value);
                    }}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {FROM_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    To currency
                  </label>
                  <select
                    value={toCurrency}
                    onChange={(e) => {
                      setCurrPairOverride("");
                      setToCurrency(e.target.value);
                    }}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {TO_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-5">
                <label className="text-sm font-medium text-slate-700">
                  currPair (override)
                </label>
                <input
                  type="text"
                  value={currPairOverride}
                  onChange={(e) => setCurrPairOverride(e.target.value)}
                  placeholder={resolvedCurrPair}
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Will send:{" "}
                  <code className="text-teal-700">{resolvedCurrPair}</code>
                </p>
              </div>

              <button
                type="button"
                onClick={fetchForexRate}
                disabled={forexLoading}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {forexLoading ? "Fetching rate…" : "Get Forex Rate"}
              </button>

              <JsonBlock value={forexResult} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
