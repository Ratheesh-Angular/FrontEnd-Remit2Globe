"use client";

import { useState } from "react";
import api from "@/lib/api";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { FlexLogo } from "@/components/brand/FlexLogo";
import { notifyApiError, notifyError } from "@/lib/notify";

export default function LoginPage() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailOrPhone) {
      notifyError("Email or phone number is required");
      return;
    }
    if (!password) {
      notifyError("Password is required");
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
        notifyError(
          "Login succeeded but session setup failed. Deploy the latest API or contact support.",
        );
        return;
      }

      const sessRes = await fetch("/api/auth/backend-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token }),
      });
      if (!sessRes.ok) {
        notifyError("Could not save your session. Please try again.");
        return;
      }
      await sessRes.json().catch(() => undefined);

      window.location.assign("/dashboard");
    } catch (error: unknown) {
      notifyApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <AppLoadingOverlay show={isLoading} label="Signing in…" />
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="flex justify-center mb-6">
          <FlexLogo priority />
        </div>

        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Welcome back
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Sign in to your Flex Money account
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="border border-slate-200 rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
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
                className="border border-slate-200 rounded-lg px-3 pr-14 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 px-1"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="cursor-pointer w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-sm">
          <p className="text-center text-slate-500">
            Don&apos;t have an account?{" "}
            <a
              href="/register"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Create one
            </a>
          </p>
          <p>
            <a
              href="/forgot-password"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Forgot password?
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
