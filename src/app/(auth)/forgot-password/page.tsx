"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import Image from "next/image";
import R2GLogo from "../../../../assets/logos/R2GLogo.png";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyApiError, notifyError, notifyInfo } from "@/lib/notify";

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
        const q = new URLSearchParams({
          email: trimmed,
          userId,
        });
        router.push(`/forgot-password/verify?${q.toString()}`);
      } else {
        notifyInfo(
          res.data.message ??
            "If an account with a password exists for that email, check your inbox. Otherwise you may need to register or use another sign-in method.",
        );
      }
    } catch (err: unknown) {
      notifyApiError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <AppLoadingOverlay show={isLoading} label="Sending code…" />
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="flex justify-center mb-6">
          {/* <Image
            src={R2GLogo}
            alt="Remit2Globe"
            priority
            className="object-contain w-[125px]"
          /> */}
          <h5 className="text-2xl font-bold text-teal-600">AMIGO</h5>
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
              className="border border-slate-200 rounded-lg px-3 h-10 w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? "Sending…" : "Continue"}
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
