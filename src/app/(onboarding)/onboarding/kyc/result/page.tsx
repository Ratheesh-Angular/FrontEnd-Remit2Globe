"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sessionApi as api } from "@/lib/api";
import { notifyApiError } from "@/lib/notify";

type PollState = "checking" | "approved" | "rejected" | "pending" | "error";

function KycResultInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const outcomeHint = searchParams.get("outcome");
  const [state, setState] = useState<PollState>("checking");
  const [message, setMessage] = useState("Checking your verification status…");
  const [reason, setReason] = useState<string | null>(null);

  const pollStatus = useCallback(async () => {
    const maxAttempts = 8;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await fetch("/api/auth/sync-backend-session", {
          method: "POST",
          credentials: "same-origin",
        });
        const res = await api.get("/kyc/signzy/status");
        const data = res.data?.data as {
          kycStatus?: string;
          journey?: { kycDecisionReason?: string | null } | null;
        };
        const kycStatus = data?.kycStatus;
        setReason(data?.journey?.kycDecisionReason ?? null);

        if (kycStatus === "APPROVED") {
          setState("approved");
          setMessage("Your identity has been verified.");
          return;
        }
        if (kycStatus === "REJECTED") {
          setState("rejected");
          setMessage("Identity verification did not pass.");
          return;
        }
      } catch (e) {
        if (i === maxAttempts - 1) {
          console.error(e);
          setState("error");
          setMessage("We could not confirm your verification status.");
          notifyApiError(e, "Could not load KYC status");
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    setState("pending");
    setMessage(
      outcomeHint === "failure"
        ? "Verification may still be processing, or it did not complete. You can retry from your profile."
        : "Verification is still processing. This usually finishes within a minute.",
    );
  }, [outcomeHint]);

  useEffect(() => {
    void pollStatus();
  }, [pollStatus]);

  useEffect(() => {
    if (state !== "approved") return;
    const t = setTimeout(() => router.push("/dashboard"), 2500);
    return () => clearTimeout(t);
  }, [state, router]);

  const retry = async () => {
    try {
      setState("checking");
      setMessage("Starting a new verification…");
      const res = await api.post("/kyc/signzy/create-journey");
      const journeyUrl = res.data?.data?.journeyUrl as string | undefined;
      if (!journeyUrl) throw new Error("No journey URL returned");
      window.location.href = journeyUrl;
    } catch (e) {
      notifyApiError(e, "Could not restart verification");
      setState("rejected");
      setMessage("Could not restart verification.");
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        {state === "checking" && (
          <div className="mx-auto h-10 w-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        )}

        {state === "approved" && (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        <h1 className="text-xl font-semibold text-slate-900">{message}</h1>

        {reason && state === "rejected" && (
          <p className="text-sm text-slate-500">{reason}</p>
        )}

        {state === "approved" && (
          <p className="text-sm text-slate-500">Redirecting to dashboard…</p>
        )}

        {(state === "rejected" || state === "pending" || state === "error") && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {(state === "rejected" || state === "pending") && (
              <button
                type="button"
                onClick={retry}
                className="cursor-pointer h-10 px-6 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/onboarding/profile")}
              className="cursor-pointer h-10 px-6 border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg"
            >
              Back to profile
            </button>
            {state === "pending" && (
              <button
                type="button"
                onClick={() => {
                  setState("checking");
                  void pollStatus();
                }}
                className="cursor-pointer h-10 px-4 text-sm text-slate-600 hover:text-slate-900 font-medium"
              >
                Refresh status
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KycResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <KycResultInner />
    </Suspense>
  );
}
