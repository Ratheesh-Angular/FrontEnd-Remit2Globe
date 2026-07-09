"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { FlexLogo } from "@/components/brand/FlexLogo";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { notifyApiError, notifyInfo } from "@/lib/notify";

const PASSWORD_RESET_SESSION_KEY = "passwordResetToken";

function maskEmail(email: string) {
  const [username, domain] = email.split("@");
  if (!domain || username.length <= 2) return email;
  return `${username.substring(0, 2)}${"*".repeat(Math.max(0, username.length - 2))}@${domain}`;
}

export default function ForgotPasswordVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const userId = searchParams.get("userId") || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!userId) return;
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
    setCanResend(true);
  }, [resendTimer, userId]);

  const verify = async (code: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        data?: { passwordResetToken?: string };
        message?: string;
      }>("/auth/forgot-password/verify", { userId, code });

      if (!res.data?.success || !res.data.data?.passwordResetToken) {
        notifyApiError(
          { response: { data: { message: res.data?.message } } },
          "Invalid or expired code",
        );
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      sessionStorage.setItem(
        PASSWORD_RESET_SESSION_KEY,
        res.data.data.passwordResetToken,
      );
      router.push("/reset-password");
    } catch (err: unknown) {
      notifyApiError(err, "Invalid or expired code");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(0, 1);
    if (!/^\d*$/.test(value)) return;

    const next = [...otp];
    next[index] = value;
    setOtp(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== "") && userId) {
      void verify(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (!canResend || !userId) return;
    setIsLoading(true);
    try {
      await api.post("/auth/forgot-password/resend", { userId });
      setResendTimer(60);
      setCanResend(false);
      notifyInfo("Verification code resent.");
    } catch (err: unknown) {
      notifyApiError(err, "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-600 mb-4">
            Missing reset session. Start from forgot password.
          </p>
          <a
            href="/forgot-password"
            className="text-red-600 hover:text-red-700 font-medium text-sm"
          >
            Forgot password
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <AppLoadingOverlay show={isLoading} label="Verifying…" />
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-center mb-6">
          <FlexLogo priority />
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Check your email
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter the 6-digit code sent to{" "}
            {email ? maskEmail(email) : "your email"}
          </p>
        </div>

        <div className="flex gap-2 justify-center mb-4">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className="w-12 h-12 text-center text-lg font-semibold border border-slate-300 rounded-lg outline-none transition-all focus:border-red-600 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
            />
          ))}
        </div>

        <p className="text-center text-sm text-slate-500 mb-2">
          Didn&apos;t receive a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend || isLoading}
            className="text-red-600 hover:text-red-700 font-medium disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {canResend ? "Resend" : `Resend in ${resendTimer}s`}
          </button>
        </p>

        <p className="text-center text-sm text-slate-500">
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
