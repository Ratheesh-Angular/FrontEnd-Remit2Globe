"use client";

import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { ArrowBigRight, ArrowRight, Lock } from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isKycPending = user?.kycStatus === "PENDING";
  const isKycSubmitted = user?.kycStatus === "SUBMITTED";
  const isKycApproved = user?.kycStatus === "APPROVED";
  const isKycRejected = user?.kycStatus === "REJECTED";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome back 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.email || user?.phone}
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
            className="shrink-0 inline-flex items-center justify-center h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Complete KYC →
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
              We are reviewing your documents. This usually takes 1–2 business
              days. We will notify you once it is done.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center justify-center h-10 px-5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
            In Review
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
      {isKycApproved && (
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
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ActionCard
          title="Send Money"
          description="Transfer funds internationally"
          href="/send"
          locked={!isKycApproved}
          onClick={() => router.push("/send")}
        />
        <ActionCard
          title="Transactions"
          description="View your transfer history"
          href="/transactions"
          locked={!isKycApproved}
          onClick={() => router.push("/transactions")}
        />
        <ActionCard
          title="Beneficiaries"
          description="Manage recipients"
          href="/beneficiaries"
          locked={!isKycApproved}
          onClick={() => router.push("/beneficiaries")}
        />
      </div>

      {/* Account status card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">
          Account Status
        </h2>
        <div className="space-y-3">
          <StatusRow
            label="Account type"
            value={user?.role === "INDIVIDUAL" ? "Individual" : "Corporate"}
          />
          <StatusRow
            label="KYC status"
            value={user?.kycStatus || "PENDING"}
            isStatus
          />
          <StatusRow
            label="Member since"
            value={
              user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"
            }
          />
        </div>
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
          // <span className="text-teal-600 text-base">
          //   <ArrowRight className="w-5 h-5" />
          // </span>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  isStatus,
}: {
  label: string;
  value: string;
  isStatus?: boolean;
}) {
  const statusColors: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    SUBMITTED: "bg-blue-50 text-blue-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
    SUSPENDED: "bg-slate-100 text-slate-600",
  };

  const statusLabels: Record<string, string> = {
    PENDING: "Pending",
    SUBMITTED: "Under Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    SUSPENDED: "Suspended",
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      {isStatus ? (
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[value] || ""}`}
        >
          {statusLabels[value] || value}
        </span>
      ) : (
        <span className="text-sm font-medium text-slate-900">{value}</span>
      )}
    </div>
  );
}
