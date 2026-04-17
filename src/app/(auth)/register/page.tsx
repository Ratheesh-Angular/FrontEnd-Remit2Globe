"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import Flag from "react-world-flags";
import { signIn } from "next-auth/react";
import { ALL_COUNTRIES, type Country } from "@/lib/phone-countries";

function oauthErrorMessage(code: string) {
  switch (code) {
    case "Callback":
      return "Google sign-in could not be completed. Please try again or register with email.";
    case "OAuthAccountNotLinked":
      return "This Google account could not be linked. Try signing in with the method you used to register.";
    case "OAuthCreateAccount":
      return "Could not create your account in the database. If this keeps happening, contact support.";
    case "Configuration":
      return "Sign-in is misconfigured. Check server environment variables.";
    case "AccessDenied":
      return "Google sign-in was cancelled or denied.";
    default:
      return `Sign-in failed (${code}). Please try again.`;
  }
}

type AccountType = "individual" | "corporate";

interface FormData {
  email: string;
  phone: string;
  country: string;
}

interface FormErrors {
  general?: string;
  email?: string;
  phone?: string;
  country?: string;
  agreed?: string;
}

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState<FormData>({
    email: "",
    phone: "",
    country: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Country selector
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const [localPhone, setLocalPhone] = useState("");
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (!err) return;
    setOauthErrorCode(err);
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("callbackUrl");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  // Detect user's country by IP on mount
  useEffect(() => {
    async function detectCountry() {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        const countryCode = data.country_code;
        const country = ALL_COUNTRIES.find((c) => c.code === countryCode);
        if (country) {
          setSelectedCountry(country);
          setFormData((prev) => ({ ...prev, country: country.name }));
        } else {
          // Default to India if detection fails
          const defaultCountry = ALL_COUNTRIES.find((c) => c.code === "IN");
          if (defaultCountry) {
            setSelectedCountry(defaultCountry);
            setFormData((prev) => ({ ...prev, country: defaultCountry.name }));
          }
        }
      } catch (error) {
        // Default to India on error
        const defaultCountry = ALL_COUNTRIES.find((c) => c.code === "IN");
        if (defaultCountry) {
          setSelectedCountry(defaultCountry);
          setFormData((prev) => ({ ...prev, country: defaultCountry.name }));
        }
      }
    }
    detectCountry();
  }, []);

  // Close country dropdown on outside click
  useEffect(() => {
    if (!countrySearchOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-country-dropdown]"))
        setCountrySearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [countrySearchOpen]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!formData.email) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = "Enter a valid email address.";
    }
    if (!formData.country) {
      errs.country = "Country is required.";
    }
    if (!selectedCountry) {
      errs.phone = "Please select a country first.";
    } else if (!localPhone) {
      errs.phone = "Phone number is required.";
    } else if (
      localPhone.length < selectedCountry.minDigits ||
      localPhone.length > selectedCountry.maxDigits
    ) {
      errs.phone =
        selectedCountry.minDigits === selectedCountry.maxDigits
          ? `Enter exactly ${selectedCountry.minDigits} digits for ${selectedCountry.name} (+${selectedCountry.dialCode}).`
          : `Enter ${selectedCountry.minDigits}–${selectedCountry.maxDigits} digits for ${selectedCountry.name} (+${selectedCountry.dialCode}).`;
    }
    // if (!agreed) {
    //   errs.agreed = "You must agree to the Terms of Service.";
    // }
    return errs;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      setIsLoading(true);
      const response = await api.post("/auth/register", {
        email: formData.email,
        phone: `+${selectedCountry!.dialCode}${localPhone}`,
        country: formData.country,
        role: accountType.toUpperCase(),
      });

      if (response.data.success) {
        setSuccessMessage("Account created! Redirecting to verification...");
        setTimeout(() => {
          window.location.href = `/verify?email=${encodeURIComponent(formData.email)}&phone=${encodeURIComponent(`+${selectedCountry!.dialCode}${localPhone}`)}`;
        }, 2000);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || "Something went wrong";
      setErrors((prev) => ({ ...prev, general: message }));
    } finally {
      setIsLoading(false);
    }
  }

  const inputBase =
    "border border-slate-200 rounded-lg px-3 h-11 w-full text-sm outline-none transition-all " +
    "focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 " +
    "placeholder:text-slate-400 text-slate-900 bg-white " +
    "disabled:bg-slate-50 disabled:cursor-not-allowed";

  const inputError =
    "border-red-400 focus:ring-2 focus:ring-red-400/20 focus:border-red-400";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 mt-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9 2L15.5 6V12L9 16L2.5 12V6L9 2Z"
                fill="white"
                fillOpacity="0.9"
              />
              <path
                d="M6 9.5L8 11.5L12 7"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            Remit 2 Globe
          </span>
        </div>
        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Create your account
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Join thousands sending money globally
          </p>
        </div>

        {oauthErrorCode && (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            role="alert"
          >
            {oauthErrorMessage(oauthErrorCode)}
          </div>
        )}

        {/* Account Type Selector */}
        <div className="mb-6">
          <label
            htmlFor="accountType"
            className="text-sm font-medium text-slate-700 mb-1.5 block"
          >
            Account Type
          </label>
          <select
            id="accountType"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
            disabled={isLoading}
            className={`${inputBase} cursor-pointer`}
          >
            <option value="personal">Personal</option>
            <option value="business">Business </option>
          </select>
        </div>

        {/* Country Selector */}
        <div className="mb-6">
          <label
            htmlFor="country"
            className="text-sm font-medium text-slate-700 mb-1.5 block"
          >
            Country
          </label>
          <div className="relative" data-country-dropdown>
            <button
              type="button"
              onClick={() => {
                setCountrySearchOpen((v) => !v);
                setCountrySearch("");
              }}
              disabled={isLoading}
              className={`${inputBase} ${errors.country ? inputError : ""} cursor-pointer flex items-center justify-between text-left`}
            >
              {selectedCountry ? (
                <div className="flex items-center gap-2.5">
                  <Flag
                    code={selectedCountry.code}
                    style={{
                      width: 20,
                      height: 14,
                      borderRadius: 2,
                      objectFit: "cover",
                    }}
                  />
                  <span className="text-slate-900">{selectedCountry.name}</span>
                </div>
              ) : (
                <span className="text-slate-400">Select your country</span>
              )}
              <svg
                className="w-4 h-4 text-slate-400 shrink-0"
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

            {/* Country Dropdown */}
            {countrySearchOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <input
                    autoFocus
                    placeholder="Search country…"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="w-full px-2.5 h-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                </div>
                <ul className="max-h-60 overflow-y-auto py-1">
                  {ALL_COUNTRIES.filter((c) =>
                    c.name.toLowerCase().includes(countrySearch.toLowerCase()),
                  ).map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCountry(c);
                          setFormData((prev) => ({ ...prev, country: c.name }));
                          setCountrySearchOpen(false);
                          setLocalPhone("");
                          setErrors((prev) => ({
                            ...prev,
                            country: undefined,
                            phone: undefined,
                          }));
                        }}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-teal-50 hover:text-teal-700 transition-colors ${
                          selectedCountry?.code === c.code
                            ? "bg-teal-50 text-teal-700 font-medium"
                            : "text-slate-700"
                        }`}
                      >
                        <Flag
                          code={c.code}
                          style={{
                            width: 20,
                            height: 14,
                            borderRadius: 2,
                            objectFit: "cover",
                          }}
                        />
                        <span>{c.name}</span>
                        {selectedCountry?.code === c.code && (
                          <svg
                            className="w-4 h-4 text-teal-600 ml-auto"
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
                  {ALL_COUNTRIES.filter((c) =>
                    c.name.toLowerCase().includes(countrySearch.toLowerCase()),
                  ).length === 0 && (
                    <li className="px-3 py-4 text-sm text-slate-400 text-center">
                      No countries found
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
          {errors.country && (
            <p className="mt-1.5 text-xs text-red-500">{errors.country}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-700 mb-1.5 block"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              className={`${inputBase} ${errors.email ? inputError : ""}`}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="text-sm font-medium text-slate-700 mb-1.5 block"
            >
              Phone number
            </label>
            <div
              className={`flex items-center border rounded-lg overflow-visible transition-all focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-600 bg-white ${
                errors.phone
                  ? "border-red-400 focus-within:ring-red-400/20 focus-within:border-red-400"
                  : "border-slate-200"
              } ${isLoading ? "bg-slate-50" : ""}`}
            >
              {/* Dial-code display (disabled) */}
              <div className="flex-shrink-0">
                <div className="flex items-center gap-1.5 px-3 h-11 text-sm bg-slate-100 border-r border-slate-200 rounded-l-lg">
                  {selectedCountry ? (
                    <>
                      <Flag
                        code={selectedCountry.code}
                        style={{
                          width: 20,
                          height: 14,
                          borderRadius: 2,
                          objectFit: "cover",
                        }}
                      />
                      <span className="text-slate-700 font-medium">
                        +{selectedCountry.dialCode}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">Select country</span>
                  )}
                </div>
              </div>

              {/* Local number input */}
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={
                  selectedCountry
                    ? `${selectedCountry.minDigits} digit number`
                    : "Select country first"
                }
                value={localPhone}
                onChange={(e) => {
                  if (selectedCountry) {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, selectedCountry.maxDigits);
                    setLocalPhone(digits);
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                disabled={isLoading || !selectedCountry}
                className="flex-1 h-11 px-3 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 disabled:cursor-not-allowed font-mono tracking-wide"
              />
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-xs text-red-500">{errors.phone}</p>
            )}
          </div>

          {/* Or Divider */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-sm text-slate-500">Or</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            {/* Continue with Google */}
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              disabled={isLoading}
              className="w-full h-11 flex items-center justify-center gap-3 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {/* Continue with Apple */}
            <button
              type="button"
              disabled={isLoading}
              className="w-full h-11 flex items-center justify-center gap-3 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M14.94 13.52c-.26.56-.39.81-.73 1.3-.48.69-1.16 1.55-2 1.56-.75.01-0.94-.48-1.96-.48s-1.24.47-1.98.49c-.82.02-1.48-.82-1.96-1.51-1.33-1.93-1.48-4.19-.65-5.39.58-.84 1.5-1.33 2.36-1.33.88 0 1.43.48 2.15.48.7 0 1.12-.48 2.13-.48.76 0 1.59.41 2.17 1.12-1.91 1.05-1.6 3.78.47 4.74zM12.03 3.78c.41-.51.73-1.23.61-1.96-.66.03-1.44.46-1.9 1-.41.47-.76 1.21-.63 1.91.74.05 1.5-.41 1.92-.95z" />
              </svg>
              Continue with Apple
            </button>
          </div>

          {/* Terms */}
          {/* <div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  setErrors((prev) => ({ ...prev, agreed: undefined }));
                }}
                disabled={isLoading}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-600 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-slate-600 leading-snug">
                I agree to the{" "}
                <a
                  href="#"
                  className="text-teal-600 hover:text-teal-700 hover:underline font-medium"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  className="text-teal-600 hover:text-teal-700 hover:underline font-medium"
                >
                  Privacy Policy
                </a>
              </span>
            </label>
            {errors.agreed && (
              <p className="mt-1.5 text-xs text-red-500">{errors.agreed}</p>
            )}
          </div> */}

          {successMessage && (
            <div className="bg-teal-50 border border-teal-200 text-teal-700 rounded-lg px-4 py-3 text-sm">
              {successMessage}
            </div>
          )}

          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {errors.general}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="cursor-pointer w-full h-11 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Bottom link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-teal-600 hover:text-teal-700 font-medium hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
