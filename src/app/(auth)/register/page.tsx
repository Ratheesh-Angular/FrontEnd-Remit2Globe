"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import api from "@/lib/api";
import Flag from "react-world-flags";
import { getSession, signIn, signOut } from "next-auth/react";
import { FlexLogo } from "@/components/brand/FlexLogo";
import {
  nationalPhonePlaceholder,
  validateNationalPhoneDigits,
} from "@/lib/phone-validation";
import { phoneCountryFromCouCode } from "@/lib/flex-country-phone";
import { matchFlexCountryByLabel } from "@/lib/catalog-countries";
import { FlexCountrySelect } from "@/components/country/FlexCountrySelect";
import {
  fieldControlBase,
  fieldControlError,
  fieldNativeSelectClasses,
  FIELD_HEIGHT,
} from "@/lib/field-styles";
import { NativeSelectShell } from "@/components/ui/NativeSelectShell";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyApiError, notifyError, notifySuccess } from "@/lib/notify";
import { useFlexCountries } from "@/hooks/useFlexCountries";
import countriesIso from "i18n-iso-countries";

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

const ACCOUNT_TYPE_TO_API_ROLE: Record<
  AccountType,
  "INDIVIDUAL" | "CORPORATE"
> = {
  individual: "INDIVIDUAL",
  corporate: "CORPORATE",
};

interface FormData {
  email: string;
  phone: string;
  country: string;
}

interface FormErrors {
  email?: string;
  phone?: string;
  country?: string;
  agreed?: string;
}

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [formData, setFormData] = useState<FormData>({
    email: "",
    phone: "",
    country: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { countries: flexCountries, loading: flexCountriesLoading } =
    useFlexCountries(true);
  const countryDetectDone = useRef(false);

  const [localPhone, setLocalPhone] = useState("");
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);

  const selectedFlexCountry = useMemo(() => {
    const raw = formData.country.trim();
    if (!raw || flexCountries.length === 0) return undefined;
    return matchFlexCountryByLabel(flexCountries, raw);
  }, [formData.country, flexCountries]);

  const selectedCountry = useMemo(() => {
    if (!selectedFlexCountry?.couCode) return null;
    return phoneCountryFromCouCode(selectedFlexCountry.couCode);
  }, [selectedFlexCountry]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    console.log("err_oauth", err);
    if (!err) return;
    setOauthErrorCode(err);
    notifyError(oauthErrorMessage(err));
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("callbackUrl");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  // Detect sender country (Flex list) from IP once countries are loaded
  useEffect(() => {
    if (flexCountriesLoading || flexCountries.length === 0) return;
    if (countryDetectDone.current) return;
    countryDetectDone.current = true;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        const a2 =
          typeof data.country_code === "string"
            ? data.country_code.toUpperCase()
            : "";
        const match =
          a2 &&
          flexCountries.find(
            (c) => countriesIso.alpha3ToAlpha2(c.couCode) === a2,
          );
        const pick = match ?? flexCountries[0];
        if (pick && !cancelled) {
          setFormData((prev) => ({ ...prev, country: pick.couName }));
        }
      } catch {
        const pick = flexCountries[0];
        if (pick && !cancelled) {
          setFormData((prev) => ({ ...prev, country: pick.couName }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flexCountriesLoading, flexCountries]);

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
    } else {
      const phoneErr = validateNationalPhoneDigits(selectedCountry, localPhone);
      if (phoneErr) errs.phone = phoneErr;
    }
    if (!agreed) {
      errs.agreed =
        "You must agree to the Terms of Service and Privacy Policy.";
    }
    return errs;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    try {
      const session = await getSession();
      if (session?.user?.id) {
        const res = await fetch("/api/auth/verify-user", {
          credentials: "same-origin",
        });
        if (res.ok) {
          window.location.assign("/dashboard");
          return;
        }
      }
      await signOut({ redirect: false });
      await fetch("/api/auth/backend-session", {
        method: "DELETE",
        credentials: "same-origin",
      });
      await signIn("google", { callbackUrl: "/dashboard" });
    } finally {
      setIsLoading(false);
    }
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
        role: ACCOUNT_TYPE_TO_API_ROLE[accountType],
      });

      if (response.data.success) {
        const userId = response.data.data?.user?.id as string | undefined;
        notifySuccess("Account created! Redirecting to verification…");
        setTimeout(() => {
          const uid = userId ? `&userId=${encodeURIComponent(userId)}` : "";
          window.location.href = `/verify?email=${encodeURIComponent(formData.email)}&phone=${encodeURIComponent(`+${selectedCountry!.dialCode}${localPhone}`)}${uid}`;
        }, 2000);
      }
    } catch (error: unknown) {
      notifyApiError(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <AppLoadingOverlay
        show={isLoading}
        label={
          accountType === "individual"
            ? "Creating account…"
            : "Creating account…"
        }
        sublabel="Please wait."
      />
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 mt-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <FlexLogo priority />
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

        {/* Account Type Selector */}
        <div className="mb-6">
          <label
            htmlFor="accountType"
            className="text-sm font-medium text-slate-700 mb-1.5 block"
          >
            Account Type
          </label>
          <NativeSelectShell>
            <select
              id="accountType"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              disabled={isLoading}
              className={`${fieldControlBase} ${fieldNativeSelectClasses}`}
            >
              <option value="individual">Personal</option>
              <option value="corporate">Business </option>
            </select>
          </NativeSelectShell>
        </div>

        {/* Country Selector (Flex API list, same as remittance) */}
        <div className="mb-6">
          <label
            htmlFor="country"
            className="text-sm font-medium text-slate-700 mb-1.5 block"
          >
            Country
          </label>
          <FlexCountrySelect
            value={formData.country}
            onChange={(couName) => {
              setFormData((prev) => ({ ...prev, country: couName }));
              setLocalPhone("");
              setErrors((prev) => ({
                ...prev,
                country: undefined,
                phone: undefined,
              }));
            }}
            error={Boolean(errors.country)}
            disabled={isLoading}
            placeholder="Select your country"
            countries={flexCountries}
            countriesLoading={flexCountriesLoading}
          />
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
              {accountType === "corporate"
                ? "Enter Business Email Address"
                : "Email address"}
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
              className={`${fieldControlBase} ${errors.email ? fieldControlError : ""}`}
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
              className={`flex items-center ${FIELD_HEIGHT} border rounded-lg overflow-visible transition-all focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-600 bg-white ${
                errors.phone
                  ? "border-red-400 focus-within:ring-red-400/20 focus-within:border-red-400"
                  : "border-slate-200"
              } ${isLoading ? "bg-slate-50" : ""}`}
            >
              {/* Dial-code display (disabled) */}
              <div className="flex-shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-3 ${FIELD_HEIGHT} text-sm bg-slate-100 border-r border-slate-200 rounded-l-lg`}
                >
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
                    ? nationalPhonePlaceholder(selectedCountry)
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
                className={`flex-1 ${FIELD_HEIGHT} px-3 text-sm outline-none bg-transparent placeholder:text-slate-400 text-slate-900 disabled:cursor-not-allowed font-mono tracking-wide`}
              />
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-xs text-red-500">{errors.phone}</p>
            )}
          </div>

          {accountType === "individual" && (
            <>
              {/* Or Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-sm text-slate-500">
                  Or
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Social Login Buttons */}
              <div className="space-y-3">
                {/* Continue with Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="cursor-pointer w-full h-11 flex items-center justify-center gap-3 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="cursor-pointer w-full h-11 flex items-center justify-center gap-3 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
            </>
          )}

          <div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  setErrors((prev) => ({ ...prev, agreed: undefined }));
                }}
                disabled={isLoading}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-red-600 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-slate-600 leading-snug">
                I agree to the{" "}
                <a
                  href="https://www.flex-money.com/terms/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 hover:text-red-700 hover:underline font-medium"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="https://www.flex-money.com/privacypolicy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 hover:text-red-700 hover:underline font-medium"
                >
                  Privacy Policy
                </a>
              </span>
            </label>
            {errors.agreed && (
              <p className="mt-1.5 text-xs text-red-500">{errors.agreed}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !agreed}
            className="cursor-pointer w-full h-11 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-2"
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
            className="text-red-600 hover:text-red-700 font-medium hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
