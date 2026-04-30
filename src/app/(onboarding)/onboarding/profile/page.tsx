"use client";

import { useEffect, useState } from "react";
import { sessionApi as api } from "@/lib/api";
import { IndividualKycWizard } from "./IndividualKycWizard";
import { CorporateKycWizard } from "./CorporateKycWizard";

export default function KycProfilePage() {
  const [role, setRole] = useState<"INDIVIDUAL" | "CORPORATE" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/kyc/profile");
        const r = res.data?.data?.role as string | undefined;
        if (!cancelled) {
          setRole(r === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL");
        }
      } catch {
        if (!cancelled) setRole("INDIVIDUAL");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
