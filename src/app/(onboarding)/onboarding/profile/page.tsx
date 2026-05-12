"use client";

import { useEffect, useState } from "react";
import { sessionApi as api } from "@/lib/api";
import { IndividualKycWizard } from "./IndividualKycWizard";
import { CorporateKycWizard } from "./CorporateKycWizard";
import { getHttpErrorStatus } from "@/lib/load-session-client";

export default function KycProfilePage() {
  const [role, setRole] = useState<"INDIVIDUAL" | "CORPORATE" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        await fetch("/api/auth/sync-backend-session", {
          method: "POST",
          credentials: "same-origin",
        });
        const res = await api.get("/kyc/profile");
        const r = res.data?.data?.role as string | undefined;
        console.log("final-checking");
        if (!cancelled) {
          setRole(r === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL");
        }
      } catch (e) {
        if (cancelled) return;
        const status = getHttpErrorStatus(e);
        console.error("[KycProfilePage] /kyc/profile", e);
        if (status === 401 || status === 403) {
          setLoadError(
            "We couldn't verify your session. Try refreshing the page or signing in again.",
          );
          return;
        }
        if (status === 404) {
          setLoadError(
            "We couldn't load your verification profile for this account. Try signing in again or contact support.",
          );
          return;
        }
        setLoadError(
          "Something went wrong loading verification. Refresh the page and try again.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-950 space-y-3"
      >
        <p>{loadError}</p>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-white font-medium"
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (role === "CORPORATE") return <CorporateKycWizard />;
  return <IndividualKycWizard />;
}
