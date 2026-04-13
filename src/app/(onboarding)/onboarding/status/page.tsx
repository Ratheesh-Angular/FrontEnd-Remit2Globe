"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";

export default function KycStatusPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto text-center space-y-8 py-12">
      {/* Success Icon */}
      <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
        <svg
          className="w-10 h-10 text-teal-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Application Submitted Successfully
        </h1>
        <p className="text-sm text-slate-500 mt-3 max-w-md mx-auto">
          Your KYC application has been submitted. Our compliance team will
          review your documents within 1 to 2 business days.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-left space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">
          Verification Progress
        </h2>

        <Step
          number={1}
          label="Application Submitted"
          description="Your documents have been uploaded"
          done
        />

        <Step
          number={2}
          label="Documents Under Review"
          description="Our team is verifying your identity"
          active
        />

        <Step
          number={3}
          label="Identity Verification"
          description="Final compliance checks"
        />

        <Step
          number={4}
          label="Account Activation"
          description="Ready to send money"
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
        <div className="flex gap-3">
          <svg
            className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">
              What happens next?
            </p>
            <p className="text-sm text-blue-700 mt-1">
              You will receive an email notification once your application has
              been reviewed. You can check your application status anytime from
              your dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center justify-center h-11 px-6 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>

        {/* <button
          onClick={() => router.push("/onboarding/documents")}
          className="inline-flex items-center justify-center h-11 px-6 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
        >
          View Documents
        </button> */}
      </div>

      {/* Timestamp */}
      <p className="text-xs text-slate-400">
        Submitted on{" "}
        {new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

// Step Component
function Step({
  number,
  label,
  description,
  done,
  active,
}: {
  number: number;
  label: string;
  description: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      {/* Step Number/Icon */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
          done
            ? "bg-teal-600 text-white"
            : active
              ? "bg-teal-50 border-2 border-teal-600 text-teal-700"
              : "bg-slate-100 text-slate-400"
        }`}
      >
        {done ? (
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          number
        )}
      </div>

      {/* Step Content */}
      <div className="flex-1 pt-0.5">
        <p
          className={`text-sm font-medium ${
            done || active ? "text-slate-900" : "text-slate-400"
          }`}
        >
          {label}
        </p>
        <p
          className={`text-xs mt-0.5 ${
            done || active ? "text-slate-500" : "text-slate-400"
          }`}
        >
          {description}
        </p>
      </div>

      {/* Connecting Line (except for last step) */}
      {number < 4 && (
        <div
          className="absolute left-[51px] mt-10 w-px h-10 bg-slate-200"
          style={{ marginLeft: "-20px" }}
        />
      )}
    </div>
  );
}
