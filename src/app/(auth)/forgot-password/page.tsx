"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { FlexLogo } from "@/components/brand/FlexLogo";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyApiError, notifyError, notifyInfo, notifySuccess } from "@/lib/notify";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      notifyError("Enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        data?: { userId: string | null };
      }>("/auth/forgot-password", { email: trimmed });

      if (!res.data?.success) {
        notifyError(res.data?.message || "Something went wrong");
        return;
      }

      const userId = res.data.data?.userId ?? null;
      if (userId) {
        notifySuccess(
          `We sent a 6-digit verification code to ${trimmed}. Check your inbox and spam folder.`,
        );
        const q = new URLSearchParams({
          email: trimmed,
          userId,
        });
        router.push(`/forgot-password/verify?${q.toString()}`);
      } else {
        notifyInfo(
          res.data.message ??
            "If an account with a password exists for that email, check your inbox. Otherwise verify the address, sign in with Google if you used it, or register.",
        );
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 503) {
        notifyApiError(
          err,
          "We could not send a verification code right now. Please try again shortly or contact support.",
        );
      } else {
        notifyApiError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <AppLoadingOverlay show={isLoading} label="Sending code…" />
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="flex justify-center mb-6">
          <FlexLogo priority />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Forgot password
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter the email for your account for verification code
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="border border-slate-200 rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? "Sending…" : "Continue"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          <a
            href="/login"
            className="text-red-600 hover:text-red-700 font-medium"
          >
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
