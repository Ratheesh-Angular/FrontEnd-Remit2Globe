"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const phone = searchParams.get("phone") || "";

  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  const [phoneOtp, setPhoneOtp] = useState(["", "", "", "", "", ""]);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
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
    setError("");

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
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      phoneInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered
    if (newOtp.every((digit) => digit !== "") && !phoneVerified && emailVerified) {
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
    setIsLoading(true);
    try {
      // TODO: Implement email verification API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setEmailVerified(true);
      // Auto-focus first phone OTP input after email verification
      setTimeout(() => {
        phoneInputRefs.current[0]?.focus();
      }, 300);
    } catch (error: any) {
      setError(error.message || "Invalid email verification code");
      setEmailOtp(["", "", "", "", "", ""]);
      emailInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhone = async (code: string) => {
    setIsLoading(true);
    try {
      // TODO: Implement phone verification API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setPhoneVerified(true);
      // Redirect to dashboard after both verifications
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (error: any) {
      setError(error.message || "Invalid phone verification code");
      setPhoneOtp(["", "", "", "", "", ""]);
      phoneInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async (type: "email" | "phone") => {
    if (!canResend) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement resend OTP API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setResendTimer(60);
      setCanResend(false);
      setError("");
    } catch (error: any) {
      setError(error.message || "Failed to resend code");
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
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
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
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Verify your account
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            We've sent verification codes to secure your account
          </p>
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="white"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="text-xs font-semibold text-slate-600">1</span>
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
                ref={(el) => (emailInputRefs.current[index] = el)}
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
              {canResend
                ? "Resend code"
                : `Resend code in ${resendTimer}s`}
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="white"
                  >
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
                ref={(el) => (phoneInputRefs.current[index] = el)}
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
              {canResend
                ? "Resend code"
                : `Resend code in ${resendTimer}s`}
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {emailVerified && phoneVerified && (
          <div className="mb-4 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <svg
              className="w-5 h-5 text-teal-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            Verification complete! Redirecting to dashboard...
          </div>
        )}

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
