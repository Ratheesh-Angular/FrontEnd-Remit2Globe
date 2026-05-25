"use client";

import { useRouter } from "next/navigation";
import { Lock, AlertCircle, Clock } from "lucide-react";

interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
  kycStatus?: string;
  createdAt?: string;
}

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();

  const displayName = user?.name?.trim() || null;

  const isKycPending = user?.kycStatus === "PENDING";
  const isKycSubmitted = user?.kycStatus === "SUBMITTED";
  const isKycApproved = user?.kycStatus === "APPROVED";
  const isKycRejected = user?.kycStatus === "REJECTED";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome back{displayName ? `, ${displayName}` : ""}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.email ?? ""}
        </p>
      </div>

      {/* KYC Banner — PENDING */}
      {isKycPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-amber-800">
              Complete your verification to start sending money
            </h2>
            <p className="text-sm text-amber-700 mt-1">
              We need to verify your identity before you can make transfers. It
              only takes a few minutes.
            </p>
          </div>
          <button
            onClick={() => router.push("/onboarding/profile")}
            className="cursor-pointer shrink-0 inline-flex items-center justify-center h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Complete KYC <AlertCircle className="w-4 h-4 ml-2 font-bold" />
          </button>
        </div>
      )}

      {/* KYC Banner — SUBMITTED / under review */}
      {isKycSubmitted && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-blue-800">
              Your application is under review
            </h2>
            <p className="text-sm text-blue-700 mt-1">
              We are reviewing your documents. This usually takes 24 Hours. We
              will notify you once it is done.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center justify-center h-10 px-5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
            In Review <Clock className="w-4 h-4 ml-2 font-bold" />
          </span>
        </div>
      )}

      {/* KYC Banner — REJECTED */}
      {isKycRejected && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-red-800">
              Verification unsuccessful
            </h2>
            <p className="text-sm text-red-700 mt-1">
              Your documents were not accepted. Please resubmit with valid
              documents.
            </p>
          </div>
          <button
            onClick={() => router.push("/onboarding/profile")}
            className="shrink-0 inline-flex items-center justify-center h-10 px-5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Resubmit KYC →
          </button>
        </div>
      )}

      {/* KYC approved — success message */}
      {/* {isKycApproved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            ✓
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Account verified
            </p>
            <p className="text-sm text-emerald-700">
              Your identity has been verified. You can now send money.
            </p>
          </div>
        </div>
      )} */}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ActionCard
          title="Beneficiaries"
          description="Manage recipients"
          href="/beneficiaries"
          locked={!isKycApproved}
          onClick={() => router.push("/beneficiaries")}
        />
        <ActionCard
          title="Send Money"
          description="Transfer funds internationally"
          href="/send-money"
          locked={!isKycApproved}
          onClick={() => router.push("/send-money")}
        />
        <ActionCard
          title="Transactions"
          description="View your transfer history"
          href="/transactions"
          locked={!isKycApproved}
          onClick={() => router.push("/transactions")}
        />
      </div>
    </div>
  );
}

// ── Helper components ──

function ActionCard({
  title,
  description,
  href,
  locked,
  onClick,
}: {
  title: string;
  description: string;
  href: string;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={() => !locked && onClick()}
      className={`
        bg-white border border-slate-200 rounded-xl p-5 transition-all
        ${
          locked
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-teal-300 hover:shadow-sm cursor-pointer"
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
        {locked ? (
          <span className="text-slate-300 text-base">
            <Lock className="w-5 h-5" />
          </span>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
}
