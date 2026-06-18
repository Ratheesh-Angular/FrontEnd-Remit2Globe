"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import Image from "next/image";
import R2GLogo from "../../../../assets/logos/R2GLogo.png";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import {
  notifyApiError,
  notifyError,
  notifyInfo,
  notifySuccess,
} from "@/lib/notify";
const PASSWORD_SETUP_SESSION_KEY = "passwordSetupToken";

export default function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const phone = searchParams.get("phone") || "";
  const userId = searchParams.get("userId") || "";

  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  const [phoneOtp, setPhoneOtp] = useState(["", "", "", "", "", ""]);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Refs for OTP inputs
  const emailInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const phoneInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer for resend button
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleEmailOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(0, 1);
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...emailOtp];
    newOtp[index] = value;
    setEmailOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      emailInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered
    if (newOtp.every((digit) => digit !== "") && !emailVerified) {
      handleVerifyEmail(newOtp.join(""));
    }
  };

  const handlePhoneOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(0, 1);
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...phoneOtp];
    newOtp[index] = value;
    setPhoneOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      phoneInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered
    if (
      newOtp.every((digit) => digit !== "") &&
      !phoneVerified &&
      emailVerified
    ) {
      handleVerifyPhone(newOtp.join(""));
    }
  };

  const handleEmailKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !emailOtp[index] && index > 0) {
      emailInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePhoneKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !phoneOtp[index] && index > 0) {
      phoneInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyEmail = async (code: string) => {
    if (!userId) {
      notifyError(
        "Missing account reference. Return to registration and try again.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post("/otp/verify-email", { userId, code });
      if (res.data.success) {
        setEmailVerified(true);
        setTimeout(() => {
          phoneInputRefs.current[0]?.focus();
        }, 300);
      }
    } catch (error: unknown) {
      notifyApiError(error, "Invalid email verification code");
      setEmailOtp(["", "", "", "", "", ""]);
      emailInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhone = async (code: string) => {
    if (!userId) {
      notifyError(
        "Missing account reference. Return to registration and try again.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post("/otp/verify-phone", { userId, code });
      if (res.data.success) {
        setPhoneVerified(true);
        const data = res.data.data as {
          fullyVerified?: boolean;
          passwordSetupToken?: string;
        };
        notifySuccess("Verification complete! Redirecting…");
        if (data?.fullyVerified && data.passwordSetupToken) {
          sessionStorage.setItem(
            PASSWORD_SETUP_SESSION_KEY,
            data.passwordSetupToken,
          );
          setTimeout(() => router.push("/set-password"), 1200);
        } else if (data?.fullyVerified) {
          setTimeout(() => router.push("/login"), 1200);
        }
      }
    } catch (error: unknown) {
      notifyApiError(error, "Invalid phone verification code");
      setPhoneOtp(["", "", "", "", "", ""]);
      phoneInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async (type: "email" | "phone") => {
    if (!canResend) return;
    if (!userId) {
      notifyError(
        "Missing account reference. Return to registration and try again.",
      );
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/otp/resend", {
        userId,
        type: type === "email" ? "EMAIL" : "PHONE",
      });
      setResendTimer(60);
      setCanResend(false);
      notifyInfo("Verification code resent.");
    } catch (error: unknown) {
      notifyApiError(error, "Failed to resend code");
    } finally {
      setIsLoading(false);
    }
  };

  const maskEmail = (email: string) => {
    const [username, domain] = email.split("@");
    if (username.length <= 2) return email;
    return `${username.substring(0, 2)}${"*".repeat(username.length - 2)}@${domain}`;
  };

  const maskPhone = (phone: string) => {
    if (phone.length <= 4) return phone;
    return `${phone.substring(0, phone.length - 4)}${"*".repeat(4)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <AppLoadingOverlay show={isLoading} label="Verifying…" />
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src={R2GLogo}
            alt="Remit2Globe"
            priority
            className="object-contain w-[125px]"
          />
        </div>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Verify your account
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            We've sent verification codes to secure your account
          </p>
          {!userId && (
            <p className="text-sm text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Missing account link. Please{" "}
              <button
                type="button"
                onClick={() => router.push("/register")}
                className="text-teal-700 font-medium underline"
              >
                register again
              </button>{" "}
              or open the link from your confirmation email.
            </p>
          )}
        </div>

        {/* Email Verification Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  emailVerified
                    ? "bg-teal-600"
                    : "bg-slate-100 border-2 border-slate-300"
                }`}
              >
                {emailVerified ? (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="white">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="text-xs font-semibold text-slate-600">
                    1
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Email Verification
                </p>
                <p className="text-xs text-slate-500">
                  Code sent to {maskEmail(email)}
                </p>
              </div>
            </div>
            {emailVerified && (
              <span className="text-xs font-medium text-teal-600">
                Verified
              </span>
            )}
          </div>

          {/* Email OTP Input */}
          <div className="flex gap-2 justify-center mb-3">
            {emailOtp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  emailInputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleEmailOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleEmailKeyDown(index, e)}
                disabled={emailVerified || isLoading}
                className={`w-12 h-12 text-center text-lg font-semibold border rounded-lg outline-none transition-all ${
                  emailVerified
                    ? "bg-teal-50 border-teal-200 text-teal-700"
                    : "border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                } disabled:cursor-not-allowed`}
              />
            ))}
          </div>

          {!emailVerified && (
            <button
              onClick={() => handleResendOtp("email")}
              disabled={!canResend || isLoading}
              className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {canResend ? "Resend code" : `Resend code in ${resendTimer}s`}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 my-6"></div>

        {/* Phone Verification Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  phoneVerified
                    ? "bg-teal-600"
                    : emailVerified
                      ? "bg-slate-100 border-2 border-slate-300"
                      : "bg-slate-50 border-2 border-slate-200"
                }`}
              >
                {phoneVerified ? (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="white">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span
                    className={`text-xs font-semibold ${
                      emailVerified ? "text-slate-600" : "text-slate-400"
                    }`}
                  >
                    2
                  </span>
                )}
              </div>
              <div>
                <p
                  className={`text-sm font-medium ${
                    emailVerified ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  Phone Verification
                </p>
                <p
                  className={`text-xs ${
                    emailVerified ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Code sent to {maskPhone(phone)}
                </p>
              </div>
            </div>
            {phoneVerified && (
              <span className="text-xs font-medium text-teal-600">
                Verified
              </span>
            )}
          </div>

          {/* Phone OTP Input */}
          <div className="flex gap-2 justify-center mb-3">
            {phoneOtp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  phoneInputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePhoneOtpChange(index, e.target.value)}
                onKeyDown={(e) => handlePhoneKeyDown(index, e)}
                disabled={!emailVerified || phoneVerified || isLoading}
                className={`w-12 h-12 text-center text-lg font-semibold border rounded-lg outline-none transition-all ${
                  phoneVerified
                    ? "bg-teal-50 border-teal-200 text-teal-700"
                    : emailVerified
                      ? "border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                      : "bg-slate-50 border-slate-200 text-slate-400"
                } disabled:cursor-not-allowed`}
              />
            ))}
          </div>

          {emailVerified && !phoneVerified && (
            <button
              onClick={() => handleResendOtp("phone")}
              disabled={!canResend || isLoading}
              className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {canResend ? "Resend code" : `Resend code in ${resendTimer}s`}
            </button>
          )}
        </div>

        {/* Help Text */}
        <p className="text-xs text-center text-slate-500">
          Didn't receive the codes?{" "}
          <button
            onClick={() => router.push("/register")}
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            Go back to registration
          </button>
        </p>
      </div>
    </div>
  );
}
