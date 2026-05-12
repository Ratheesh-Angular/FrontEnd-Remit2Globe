"use client";

import { useState } from "react";
import api from "@/lib/api";

export default function LoginPage() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!emailOrPhone) {
      setError("Email or phone number is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    try {
      setIsLoading(true);

      const response = await api.post("/auth/login", {
        emailOrPhone,
        password,
      });

      if (!response.data?.success) return;

      const token = response.data.data?.token as string | undefined;
      if (!token) {
        setError(
          "Login succeeded but session setup failed. Deploy the latest API or contact support.",
        );
        return;
      }

      /** Mirror backend JWT into an httpOnly cookie on the Next origin so middleware sees `token`. */
      const sessRes = await fetch("/api/auth/backend-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token }),
      });
      if (!sessRes.ok) {
        setError("Could not save your session. Please try again.");
        return;
      }
      await sessRes.json().catch(() => undefined);

      window.location.assign("/dashboard");
    } catch (error: any) {
      setError(error.response?.data?.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-teal-600 rounded-lg shrink-0" />
          <span className="text-xl font-semibold text-slate-900">
            Remit2Globe
          </span>
        </div>

        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Welcome back
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Sign in to your Remit2Globe account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email or Phone */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Email or Phone Number
            </label>
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="you@example.com or +1234567890"
              autoComplete="username"
              className="border border-slate-200 rounded-lg px-3 h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                className="border border-slate-200 rounded-lg px-3 pr-14 h-11 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 px-1"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
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
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-sm">
          <p className="text-center text-slate-500">
            Don&apos;t have an account?{" "}
            <a
              href="/register"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Create one
            </a>
          </p>
          <p>
            <a
              href="/forgot-password"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Forgot password?
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
