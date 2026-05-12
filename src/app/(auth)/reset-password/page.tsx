"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  getPasswordRequirementRows,
  getPasswordStrength,
  meetsStrongPassword,
  type PasswordStrength,
} from "@/lib/passwordStrength";

const SESSION_KEY = "passwordResetToken";

function strengthLabel(s: PasswordStrength): string {
  switch (s) {
    case "strong":
      return "Strong";
    case "medium":
      return "Medium";
    case "weak":
    default:
      return "Weak";
  }
}

function strengthBarClass(s: PasswordStrength): string {
  switch (s) {
    case "strong":
      return "bg-emerald-500";
    case "medium":
      return "bg-amber-400";
    case "weak":
    default:
      return "bg-red-500";
  }
}

function strengthTextClass(s: PasswordStrength): string {
  switch (s) {
    case "strong":
      return "text-emerald-600";
    case "medium":
      return "text-amber-600";
    case "weak":
    default:
      return "text-red-600";
  }
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = sessionStorage.getItem(SESSION_KEY);
    if (!t) {
      router.replace("/forgot-password");
      return;
    }
    setReady(true);
  }, [router]);

  const strength = getPasswordStrength(password);
  const requirementRows = getPasswordRequirementRows(password);
  const strongOk = meetsStrongPassword(password);
  const matchOk = password.length > 0 && password === confirm;
  const canSubmit = strongOk && matchOk && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;

    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem(SESSION_KEY)
        : null;
    if (!token) {
      setError("Session expired. Start forgot password again.");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        password,
      });
      sessionStorage.removeItem(SESSION_KEY);
      router.push("/login");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || "Could not update password.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const barWidth =
    strength === "strong" ? "100%" : strength === "medium" ? "66%" : "33%";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
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

        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Reset your password
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Choose a new password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                className="border border-slate-200 rounded-lg px-3 pr-10 h-11 w-full text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 placeholder:text-slate-400"
                placeholder="Enter a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 px-1"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {password.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex h-2 rounded-full bg-slate-100 overflow-hidden ring-1 ring-inset ring-slate-200/60">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${strengthBarClass(strength)}`}
                    style={{ width: barWidth }}
                  />
                </div>
                <p
                  className={`text-xs font-semibold tracking-wide uppercase ${strengthTextClass(strength)}`}
                >
                  {strengthLabel(strength)}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800 mb-3">
                Password needs at least:
              </p>
              <ul className="space-y-2.5" role="list">
                {requirementRows.map((row) => (
                  <li key={row.id} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold leading-none transition-colors ${
                        row.met
                          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                          : "border-slate-300 bg-white text-slate-300"
                      }`}
                      aria-hidden
                    >
                      {row.met ? "✓" : ""}
                    </span>
                    <span
                      className={`text-sm leading-snug pt-0.5 transition-colors ${
                        row.met
                          ? "text-emerald-800 font-medium"
                          : "text-slate-600"
                      }`}
                    >
                      {row.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                className="border border-slate-200 rounded-lg px-3 pr-10 h-11 w-full text-sm outline-none transition-all focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 placeholder:text-slate-400"
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 px-1"
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
            {confirm.length > 0 && !matchOk && (
              <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
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
                Saving…
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          <a
            href="/login"
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
