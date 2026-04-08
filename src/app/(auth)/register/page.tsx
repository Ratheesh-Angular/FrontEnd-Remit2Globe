"use client";

import { useState } from "react";
import api from "@/lib/api";

type AccountType = "individual" | "corporate";

interface FormData {
  email: string;
  phone: string;
  password: string;
  confirm: string;
}

interface FormErrors {
  general?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  agreed?: string;
}

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState<FormData>({
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!formData.email) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = "Enter a valid email address.";
    }
    if (!formData.phone) {
      errs.phone = "Phone number is required.";
    }
    if (!formData.password) {
      errs.password = "Password is required.";
    } else if (formData.password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (!formData.confirm) {
      errs.confirm = "Please confirm your password.";
    } else if (formData.password !== formData.confirm) {
      errs.confirm = "Passwords do not match.";
    }
    if (!agreed) {
      errs.agreed = "You must agree to the Terms of Service.";
    }
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
        phone: formData.phone,
        password: formData.password,
        confirmPassword: formData.confirm,
        role: accountType.toUpperCase(),
      });

      if (response.data.success) {
        setSuccessMessage("Account created! Redirecting...");
        setTimeout(() => {
          window.location.href = "/login";
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
      {/* Logo */}
      <div className="flex items-center gap-2.5">
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

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 mt-8">
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
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Individual */}
          <button
            type="button"
            onClick={() => setAccountType("individual")}
            className={
              "flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-all " +
              (accountType === "individual"
                ? "border-teal-600 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")
            }
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className={
                accountType === "individual"
                  ? "text-teal-600"
                  : "text-slate-400"
              }
            >
              <circle
                cx="10"
                cy="7"
                r="3.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm font-medium leading-none mt-0.5">
              Individual
            </span>
            <span
              className={
                "text-xs leading-snug " +
                (accountType === "individual"
                  ? "text-teal-600/80"
                  : "text-slate-400")
              }
            >
              Personal transfers
            </span>
          </button>

          {/* Corporate */}
          <button
            type="button"
            onClick={() => setAccountType("corporate")}
            className={
              "flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-all " +
              (accountType === "corporate"
                ? "border-teal-600 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")
            }
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className={
                accountType === "corporate" ? "text-teal-600" : "text-slate-400"
              }
            >
              <rect
                x="2.5"
                y="7"
                width="15"
                height="11"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M6.5 7V5a3.5 3.5 0 0 1 7 0v2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M7 12h2M11 12h2M7 15h2M11 15h2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm font-medium leading-none mt-0.5">
              Corporate
            </span>
            <span
              className={
                "text-xs leading-snug " +
                (accountType === "corporate"
                  ? "text-teal-600/80"
                  : "text-slate-400")
              }
            >
              Business payments
            </span>
          </button>
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
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm text-slate-400 select-none pointer-events-none">
                +
              </span>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="1 555 000 0000"
                value={formData.phone}
                onChange={handleChange}
                disabled={isLoading}
                className={`${inputBase} pl-6 ${errors.phone ? inputError : ""}`}
              />
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-xs text-red-500">{errors.phone}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700 mb-1.5 block"
            >
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                className={`${inputBase} pr-10 ${errors.password ? inputError : ""}`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirm"
              className="text-sm font-medium text-slate-700 mb-1.5 block"
            >
              Confirm password
            </label>
            <div className="relative flex items-center">
              <input
                id="confirm"
                name="confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={formData.confirm}
                onChange={handleChange}
                disabled={isLoading}
                className={`${inputBase} pr-10 ${errors.confirm ? inputError : ""}`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.confirm && (
              <p className="mt-1.5 text-xs text-red-500">{errors.confirm}</p>
            )}
          </div>

          {/* Terms */}
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
          </div>

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
            className="w-full h-11 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-2"
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
