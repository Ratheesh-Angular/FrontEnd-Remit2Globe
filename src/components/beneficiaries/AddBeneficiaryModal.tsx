"use client";

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import api from "@/lib/api";
import Flag from "react-world-flags";
import countriesIso from "i18n-iso-countries";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function flexApiUrl(path: string) {
  return `${API_ROOT.replace(/\/$/, "")}/flex${path}`;
}

interface FlexCountry {
  couCode: string;
  couName: string;
}

interface FlexBank {
  serviceType?: string;
  bankCode: string;
  bankName: string;
}

function alpha2FromCouCode(couCode: string): string | undefined {
  const u = couCode?.trim().toUpperCase();
  if (!u) return undefined;
  return countriesIso.alpha3ToAlpha2(u) || undefined;
}

function dialCodeFromCouCode(couCode: string): string | undefined {
  const a2 = alpha2FromCouCode(couCode);
  if (!a2) return undefined;
  try {
    return getCountryCallingCode(a2 as CountryCode);
  } catch {
    return undefined;
  }
}

function FlexCountryFlag({
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
        code={a2}
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


type DeliveryChannel = "BANK_TRANSFER" | "MOBILE_MONEY";

export interface CreatedBeneficiaryPayload {
  id: string;
  fullName: string;
  deliveryChannel: DeliveryChannel;
  country?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  swiftBic?: string | null;
  mobileMoneyProvider?: string | null;
  mobileNumber?: string | null;
}

export type LockCountry = {
  couName: string;
  couCode?: string;
};

export type AddBeneficiaryModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create, before `onClose`. May return a Promise. */
  onSuccess?: (
    beneficiary: CreatedBeneficiaryPayload,
  ) => void | Promise<void>;
  /** When set, destination country is fixed to this corridor (Flex list match). */
  lockCountry?: LockCountry | null;
};

interface FormData {
  deliveryChannel: DeliveryChannel;
  fullName: string;
  // Bank Transfer
  country: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  swiftBic: string;
  // Mobile Money
  mobileMoneyProvider: string;
  mobileNumber: string;
}

const emptyForm: FormData = {
  deliveryChannel: "BANK_TRANSFER",
  fullName: "",
  country: "",
  bankName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  swiftBic: "",
  mobileMoneyProvider: "",
  mobileNumber: "",
};

export function AddBeneficiaryModal({
  open,
  onClose,
  onSuccess,
  lockCountry = null,
}: AddBeneficiaryModalProps) {
  const countryLocked = Boolean(
    lockCountry &&
      (lockCountry.couName?.trim() || lockCountry.couCode?.trim()),
  );

  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isConfirmingAccount, setIsConfirmingAccount] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [localMobileNumber, setLocalMobileNumber] = useState("");
  const [flexCountries, setFlexCountries] = useState<FlexCountry[]>([]);
  const [flexCountriesLoading, setFlexCountriesLoading] = useState(false);
  const [flexCountriesError, setFlexCountriesError] = useState("");
  const [flexBanks, setFlexBanks] = useState<FlexBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  const filteredFlexCountries = useMemo(() => {
    const q = countrySearch.toLowerCase().trim();
    if (!q) return flexCountries;
    return flexCountries.filter(
      (c) =>
        c.couName.toLowerCase().includes(q) ||
        c.couCode.toLowerCase().includes(q),
    );
  }, [flexCountries, countrySearch]);

  const filteredFlexBanks = useMemo(() => {
    const q = bankSearch.toLowerCase().trim();
    if (!q) return flexBanks;
    return flexBanks.filter(
      (b) =>
        b.bankName.toLowerCase().includes(q) ||
        b.bankCode.toLowerCase().includes(q),
    );
  }, [flexBanks, bankSearch]);

  const selectedFlexCountry = flexCountries.find(
    (c) => c.couName === formData.country,
  );

  // Close country dropdown on outside click
  useEffect(() => {
    if (!countryOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-country-dropdown]")) setCountryOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [countryOpen]);

  useEffect(() => {
    if (!bankOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-bank-dropdown]")) setBankOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [bankOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFlexCountriesLoading(true);
    setFlexCountriesError("");
    fetch(flexApiUrl("/countries"), { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        const list = json?.data?.data;
        if (!cancelled)
          setFlexCountries(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) {
          setFlexCountries([]);
          setFlexCountriesError("Could not load countries");
        }
      })
      .finally(() => {
        if (!cancelled) setFlexCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !lockCountry || flexCountries.length === 0) return;
    const byCode =
      lockCountry.couCode &&
      flexCountries.find(
        (c) => c.couCode.toUpperCase() === lockCountry.couCode!.toUpperCase(),
      );
    const byName = flexCountries.find(
      (c) =>
        c.couName.trim().toLowerCase() ===
        lockCountry.couName.trim().toLowerCase(),
    );
    const match = byCode || byName;
    if (match) {
      setFormData((prev) => ({ ...prev, country: match.couName }));
    }
  }, [open, lockCountry, flexCountries]);

  useEffect(() => {
    if (!open) return;
    setFormData(
      lockCountry?.couName?.trim()
        ? { ...emptyForm, country: lockCountry.couName.trim() }
        : emptyForm,
    );
    setErrors({});
    setSaveError("");
    setIsConfirmingAccount(false);
    setCountryOpen(false);
    setCountrySearch("");
    setLocalMobileNumber("");
    setFlexBanks([]);
    setBankOpen(false);
    setBankSearch("");
  }, [open, lockCountry?.couName]);

  useEffect(() => {
    if (!open) {
      setFlexBanks([]);
      setBanksLoading(false);
      return;
    }
    if (formData.deliveryChannel !== "BANK_TRANSFER") {
      setFlexBanks([]);
      setBanksLoading(false);
      return;
    }
    const couCode = selectedFlexCountry?.couCode;
    if (!couCode) {
      setFlexBanks([]);
      setBanksLoading(false);
      return;
    }
    const ac = new AbortController();
    setBanksLoading(true);
    fetch(flexApiUrl(`/banks/${encodeURIComponent(couCode)}`), {
      credentials: "include",
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        setFlexBanks(Array.isArray(json?.data) ? json.data : []);
      })
      .catch(() => {
        if (!ac.signal.aborted) setFlexBanks([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setBanksLoading(false);
      });
    return () => ac.abort();
  }, [
    open,
    formData.deliveryChannel,
    formData.country,
    selectedFlexCountry?.couCode,
  ]);

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaveError("");
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (!formData.fullName.trim()) errs.fullName = "Full name is required";

    if (formData.deliveryChannel === "BANK_TRANSFER") {
      if (!formData.country.trim()) errs.country = "Country is required";
      if (!formData.bankName.trim()) errs.bankName = "Bank name is required";
      if (!formData.accountNumber.trim())
        errs.accountNumber = "Account number is required";
      if (!formData.confirmAccountNumber.trim())
        errs.confirmAccountNumber = "Please confirm account number";
      else if (formData.accountNumber !== formData.confirmAccountNumber)
        errs.confirmAccountNumber = "Account numbers do not match";
      if (!formData.swiftBic.trim())
        errs.swiftBic = "SWIFT/BIC code is required";
    }

    if (formData.deliveryChannel === "MOBILE_MONEY") {
      if (!formData.country.trim()) errs.country = "Country is required";
      if (!formData.mobileMoneyProvider.trim())
        errs.mobileMoneyProvider = "Provider is required";
      if (!localMobileNumber.trim())
        errs.mobileNumber = "Mobile number is required";
      else {
        const digits = localMobileNumber.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15)
          errs.mobileNumber = "Enter a valid mobile number (7–15 digits)";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSaving(true);
      setSaveError("");

      const payload: any = {
        deliveryChannel: formData.deliveryChannel,
        fullName: formData.fullName.trim(),
      };

      if (formData.deliveryChannel === "BANK_TRANSFER") {
        payload.country = formData.country.trim();
        payload.bankName = formData.bankName.trim();
        payload.accountNumber = formData.confirmAccountNumber.trim(); // Use confirmed account number
        payload.swiftBic = formData.swiftBic.trim();
      } else {
        payload.country = formData.country.trim();
        payload.mobileMoneyProvider = formData.mobileMoneyProvider.trim();
        const fc = flexCountries.find((c) => c.couName === formData.country);
        const dial = fc ? dialCodeFromCouCode(fc.couCode) : undefined;
        const digits = localMobileNumber.replace(/\D/g, "");
        payload.mobileNumber =
          dial && digits ? `+${dial}${digits}` : digits || localMobileNumber;
      }

      const res = await api.post<{
        success: boolean;
        data: { beneficiary: CreatedBeneficiaryPayload };
      }>("/beneficiaries", payload);
      const created = res.data.data.beneficiary;
      await onSuccess?.(created);
      onClose();
    } catch (error: any) {
      setSaveError(
        error.response?.data?.message || "Failed to add beneficiary",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Add New Beneficiary
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Delivery Channel */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Delivery Channel <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.deliveryChannel}
                  onChange={(e) =>
                    handleChange(
                      "deliveryChannel",
                      e.target.value as DeliveryChannel,
                    )
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                </select>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">
                  Beneficiary Full Name (as per bank account){" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                    errors.fullName ? "border-red-400" : "border-slate-200"
                  }`}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>
                )}
              </div>

              {/* Bank Transfer Fields */}
              {formData.deliveryChannel === "BANK_TRANSFER" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Destination Country{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    {countryLocked ? (
                      <>
                        <div className="flex items-center gap-2 w-full border border-slate-200 rounded-lg px-3 h-10 text-sm bg-slate-50 text-slate-800">
                          {selectedFlexCountry ? (
                            <>
                              <FlexCountryFlag
                                couCode={selectedFlexCountry.couCode}
                              />
                              <span className="font-medium">
                                {selectedFlexCountry.couName}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium">
                              {formData.country ||
                                lockCountry?.couName?.trim() ||
                                "—"}
                            </span>
                          )}
                          <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-400 shrink-0">
                            From transfer
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Country matches the recipient you selected for this
                          transfer.
                        </p>
                      </>
                    ) : (
                      <div className="relative" data-country-dropdown>
                        <button
                          type="button"
                          onClick={() => {
                            setCountryOpen((v) => !v);
                            setCountrySearch("");
                            setBankOpen(false);
                          }}
                          className={`flex items-center gap-2 w-full border rounded-lg px-3 h-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors bg-white ${
                            errors.country
                              ? "border-red-400"
                              : "border-slate-200"
                          } ${formData.country ? "text-slate-900" : "text-slate-400"}`}
                        >
                          {formData.country && selectedFlexCountry ? (
                            <>
                              <FlexCountryFlag
                                couCode={selectedFlexCountry.couCode}
                              />
                              <span>{formData.country}</span>
                            </>
                          ) : formData.country ? (
                            <span>{formData.country}</span>
                          ) : (
                            <span>Select country…</span>
                          )}
                          <svg
                            className="ml-auto w-4 h-4 text-slate-400 shrink-0"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>

                        {countryOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            <div className="p-2 border-b border-slate-100">
                              <input
                                autoFocus
                                placeholder="Search country…"
                                value={countrySearch}
                                onChange={(e) =>
                                  setCountrySearch(e.target.value)
                                }
                                className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                              />
                            </div>
                            <ul className="max-h-52 overflow-y-auto py-1">
                              {flexCountriesLoading && (
                                <li className="px-3 py-4 text-sm text-slate-400 text-center">
                                  Loading countries…
                                </li>
                              )}
                              {!flexCountriesLoading &&
                                filteredFlexCountries.map((c) => (
                                  <li key={c.couCode}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleChange("country", c.couName);
                                        handleChange("bankName", "");
                                        setCountryOpen(false);
                                        setBankSearch("");
                                        setBankOpen(false);
                                      }}
                                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-teal-50 hover:text-teal-700 transition-colors ${
                                        formData.country === c.couName
                                          ? "bg-teal-50 text-teal-700 font-medium"
                                          : "text-slate-700"
                                      }`}
                                    >
                                      <FlexCountryFlag couCode={c.couCode} />
                                      <span>{c.couName}</span>
                                      {formData.country === c.couName && (
                                        <svg
                                          className="ml-auto w-4 h-4 text-teal-600"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      )}
                                    </button>
                                  </li>
                                ))}
                              {!flexCountriesLoading &&
                                filteredFlexCountries.length === 0 && (
                                  <li className="px-3 py-4 text-sm text-slate-400 text-center">
                                    {flexCountriesError
                                      ? flexCountriesError
                                      : "No countries found"}
                                  </li>
                                )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {errors.country && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.country}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative" data-bank-dropdown>
                      <button
                        type="button"
                        disabled={
                          !formData.country ||
                          banksLoading ||
                          flexBanks.length === 0
                        }
                        onClick={() => {
                          if (
                            !formData.country ||
                            banksLoading ||
                            flexBanks.length === 0
                          )
                            return;
                          setBankOpen((v) => !v);
                          setBankSearch("");
                          setCountryOpen(false);
                        }}
                        className={`flex items-center gap-2 w-full border rounded-lg px-3 h-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
                          errors.bankName ? "border-red-400" : "border-slate-200"
                        } ${formData.bankName ? "text-slate-900" : "text-slate-400"}`}
                      >
                        {banksLoading ? (
                          <span>Loading banks…</span>
                        ) : flexBanks.length === 0 && formData.country ? (
                          <span>No banks for this country</span>
                        ) : formData.bankName ? (
                          <span className="truncate">{formData.bankName}</span>
                        ) : (
                          <span>Select bank…</span>
                        )}
                        <svg
                          className="ml-auto w-4 h-4 text-slate-400 shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      {bankOpen && flexBanks.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                          <div className="p-2 border-b border-slate-100">
                            <input
                              autoFocus
                              placeholder="Search bank…"
                              value={bankSearch}
                              onChange={(e) => setBankSearch(e.target.value)}
                              className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                            />
                          </div>
                          <ul className="max-h-52 overflow-y-auto py-1">
                            {filteredFlexBanks.map((b) => (
                              <li key={b.bankCode}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleChange("bankName", b.bankName);
                                    setBankOpen(false);
                                  }}
                                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-teal-50 hover:text-teal-700 transition-colors ${
                                    formData.bankName === b.bankName
                                      ? "bg-teal-50 text-teal-700 font-medium"
                                      : "text-slate-700"
                                  }`}
                                >
                                  <span className="truncate">{b.bankName}</span>
                                  {formData.bankName === b.bankName && (
                                    <svg
                                      className="ml-auto w-4 h-4 shrink-0 text-teal-600"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </button>
                              </li>
                            ))}
                            {filteredFlexBanks.length === 0 && (
                              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                                No banks match your search
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                    {errors.bankName && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.bankName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Account Number / IBAN{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={isConfirmingAccount ? "password" : "text"}
                      placeholder="0123456789"
                      value={formData.accountNumber}
                      onChange={(e) => {
                        handleChange("accountNumber", e.target.value);
                        // Inline validation if confirm field has value
                        if (
                          formData.confirmAccountNumber &&
                          e.target.value !== formData.confirmAccountNumber
                        ) {
                          setErrors((prev) => ({
                            ...prev,
                            confirmAccountNumber:
                              "Account numbers do not match",
                          }));
                        } else if (
                          formData.confirmAccountNumber &&
                          e.target.value === formData.confirmAccountNumber
                        ) {
                          setErrors((prev) => ({
                            ...prev,
                            confirmAccountNumber: undefined,
                          }));
                        }
                      }}
                      onFocus={() => setIsConfirmingAccount(false)}
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.accountNumber
                          ? "border-red-400"
                          : "border-slate-200"
                      }`}
                    />
                    {errors.accountNumber && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.accountNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Confirm Account Number / IBAN{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Re-enter account number"
                      value={formData.confirmAccountNumber}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      onChange={(e) => {
                        handleChange("confirmAccountNumber", e.target.value);
                        // Inline validation
                        if (
                          e.target.value &&
                          formData.accountNumber !== e.target.value
                        ) {
                          setErrors((prev) => ({
                            ...prev,
                            confirmAccountNumber:
                              "Account numbers do not match",
                          }));
                        } else {
                          setErrors((prev) => ({
                            ...prev,
                            confirmAccountNumber: undefined,
                          }));
                        }
                      }}
                      onFocus={() => setIsConfirmingAccount(true)}
                      onBlur={() => setIsConfirmingAccount(false)}
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.confirmAccountNumber
                          ? "border-red-400"
                          : "border-slate-200"
                      }`}
                    />
                    {errors.confirmAccountNumber && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.confirmAccountNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      SWIFT/BIC / Routing / Transit Number{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="EQBLKENA"
                      value={formData.swiftBic}
                      onChange={(e) => handleChange("swiftBic", e.target.value)}
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.swiftBic ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    {errors.swiftBic && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.swiftBic}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Mobile Money Fields */}
              {formData.deliveryChannel === "MOBILE_MONEY" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Country <span className="text-red-500">*</span>
                    </label>
                    {countryLocked ? (
                      <>
                        <div className="flex items-center gap-2 w-full border border-slate-200 rounded-lg px-3 h-10 text-sm bg-slate-50 text-slate-800">
                          {selectedFlexCountry ? (
                            <>
                              <FlexCountryFlag
                                couCode={selectedFlexCountry.couCode}
                              />
                              <span className="font-medium">
                                {selectedFlexCountry.couName}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium">
                              {formData.country ||
                                lockCountry?.couName?.trim() ||
                                "—"}
                            </span>
                          )}
                          <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-400 shrink-0">
                            From transfer
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Country matches the recipient you selected for this
                          transfer.
                        </p>
                      </>
                    ) : (
                      <div className="relative" data-country-dropdown>
                        <button
                          type="button"
                          onClick={() => {
                            setCountryOpen((v) => !v);
                            setCountrySearch("");
                            setBankOpen(false);
                          }}
                          className={`flex items-center gap-2 w-full border rounded-lg px-3 h-10 text-sm text-left focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors bg-white ${
                            errors.country
                              ? "border-red-400"
                              : "border-slate-200"
                          } ${formData.country ? "text-slate-900" : "text-slate-400"}`}
                        >
                          {formData.country && selectedFlexCountry ? (
                            <>
                              <FlexCountryFlag
                                couCode={selectedFlexCountry.couCode}
                              />
                              <span>{formData.country}</span>
                            </>
                          ) : formData.country ? (
                            <span>{formData.country}</span>
                          ) : (
                            <span>Select country…</span>
                          )}
                          <svg
                            className="ml-auto w-4 h-4 text-slate-400 shrink-0"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>

                        {countryOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            <div className="p-2 border-b border-slate-100">
                              <input
                                autoFocus
                                placeholder="Search country…"
                                value={countrySearch}
                                onChange={(e) =>
                                  setCountrySearch(e.target.value)
                                }
                                className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                              />
                            </div>
                            <ul className="max-h-52 overflow-y-auto py-1">
                              {flexCountriesLoading && (
                                <li className="px-3 py-4 text-sm text-slate-400 text-center">
                                  Loading countries…
                                </li>
                              )}
                              {!flexCountriesLoading &&
                                filteredFlexCountries.map((c) => (
                                  <li key={c.couCode}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleChange("country", c.couName);
                                        setCountryOpen(false);
                                        setLocalMobileNumber("");
                                      }}
                                      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-teal-50 hover:text-teal-700 transition-colors ${
                                        formData.country === c.couName
                                          ? "bg-teal-50 text-teal-700 font-medium"
                                          : "text-slate-700"
                                      }`}
                                    >
                                      <FlexCountryFlag couCode={c.couCode} />
                                      <span>{c.couName}</span>
                                      {formData.country === c.couName && (
                                        <svg
                                          className="ml-auto w-4 h-4 text-teal-600"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      )}
                                    </button>
                                  </li>
                                ))}
                              {!flexCountriesLoading &&
                                filteredFlexCountries.length === 0 && (
                                  <li className="px-3 py-4 text-sm text-slate-400 text-center">
                                    {flexCountriesError
                                      ? flexCountriesError
                                      : "No countries found"}
                                  </li>
                                )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {errors.country && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.country}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Mobile Money Provider{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.mobileMoneyProvider}
                      onChange={(e) =>
                        handleChange("mobileMoneyProvider", e.target.value)
                      }
                      className={`w-full border rounded-lg px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors ${
                        errors.mobileMoneyProvider
                          ? "border-red-400"
                          : "border-slate-200"
                      } ${formData.mobileMoneyProvider ? "text-slate-900" : "text-slate-400"}`}
                    >
                      <option value="">Select provider</option>
                      <option value="M-Pesa">M-Pesa</option>
                      <option value="Wallet Money">Wallet Money</option>
                    </select>
                    {errors.mobileMoneyProvider && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.mobileMoneyProvider}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <div
                      className={`flex items-center border rounded-lg overflow-visible transition-all focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-600 bg-white ${
                        errors.mobileNumber
                          ? "border-red-400 focus-within:ring-red-400/20 focus-within:border-red-400"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-1.5 px-3 h-10 text-sm bg-slate-100 border-r border-slate-200 rounded-l-lg">
                          {formData.country && selectedFlexCountry ? (
                            <>
                              <FlexCountryFlag
                                couCode={selectedFlexCountry.couCode}
                              />
                              {dialCodeFromCouCode(
                                selectedFlexCountry.couCode,
                              ) ? (
                                <span className="text-slate-700 font-medium">
                                  +
                                  {dialCodeFromCouCode(
                                    selectedFlexCountry.couCode,
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-xs">
                                  —
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">
                              Select country
                            </span>
                          )}
                        </div>
                      </div>

                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder={
                          formData.country && selectedFlexCountry
                            ? "National mobile number (7–15 digits)"
                            : "Select country first"
                        }
                        value={localMobileNumber}
                        onChange={(e) => {
                          if (!selectedFlexCountry) return;
                          const digits = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 15);
                          setLocalMobileNumber(digits);
                          setErrors((prev) => ({
                            ...prev,
                            mobileNumber: undefined,
                          }));
                        }}
                        disabled={!formData.country}
                        className="flex-1 h-10 px-3 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 disabled:cursor-not-allowed font-mono tracking-wide"
                      />
                    </div>
                    {errors.mobileNumber && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.mobileNumber}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Error */}
              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {saveError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="flex-1 h-10 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Beneficiary"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
