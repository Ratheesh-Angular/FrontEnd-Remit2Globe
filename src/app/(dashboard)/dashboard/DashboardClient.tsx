"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Lock,
  AlertCircle,
  Clock,
  ChevronRight,
  Wallet,
  Users,
  Send,
} from "lucide-react";
import { sessionApi as api } from "@/lib/api";
import type { RemittanceTransferRow } from "@/lib/transfer-receipt-from-transfer";
import { RemittanceTransfersTable } from "@/components/transactions/RemittanceTransfersTable";
import { ViewTransactionModal } from "@/components/transactions/ViewTransactionModal";
import { Loader } from "@/components/ui/Loader";

interface User {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
  kycStatus?: string;
  createdAt?: string;
}

type Lookups = {
  sourceOfIncome: { value: string; label: string }[];
  transferPurpose: { value: string; label: string }[];
  relationship: { value: string; label: string }[];
};

/** Last transfers on dashboard + view modal — same UX as Transactions page table. */
function DashboardTransactionHistory() {
  const [rows, setRows] = useState<RemittanceTransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const loadTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        data: { transfers: RemittanceTransferRow[] };
      }>("/remittance/transfers", { params: { limit: "5" } });
      setRows(res.data.data.transfers);
    } catch (e) {
      console.error("Dashboard: could not load transactions", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    let c = false;
    void api
      .get<{
        data: {
          sourceOfIncome: Lookups["sourceOfIncome"];
          transferPurpose: Lookups["transferPurpose"];
          relationship: Lookups["relationship"];
        };
      }>("/remittance/lookups")
      .then((res) => {
        if (c) return;
        setLookups({
          sourceOfIncome: res.data.data.sourceOfIncome,
          transferPurpose: res.data.data.transferPurpose,
          relationship: res.data.data.relationship,
        });
      })
      .catch(() => {
        if (!c) setLookups(null);
      });
    return () => {
      c = true;
    };
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex flex-row items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          Transaction history
        </h2>
        <Link
          href="/transactions"
          className="cursor-pointer shrink-0 inline-flex items-center gap-0.5 text-sm font-medium text-teal-700 hover:text-teal-800 transition-colors"
        >
          View all
          <ChevronRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 flex justify-center">
          <Loader
            variant="inline"
            size="md"
            label="Loading recent transactions…"
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
          <p className="text-sm text-slate-600">
            No transfers yet.{" "}
            <Link
              href="/send-money"
              className="font-medium text-teal-700 hover:text-teal-800 underline-offset-2 hover:underline"
            >
              Send money
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <RemittanceTransfersTable
          rows={rows}
          onViewTransfer={(id) => setViewId(id)}
        />
      )}

      <ViewTransactionModal
        open={viewId !== null}
        transferId={viewId}
        onClose={() => setViewId(null)}
        lookups={lookups}
        onTransferUpdated={() => void loadTransfers()}
      />
    </section>
  );
}

export default function DashboardClient({ user }: { user: User }) {
  const router = useRouter();

  const displayName = user?.name?.trim() || null;

  const isKycPending = user?.kycStatus === "PENDING";
  const isKycSubmitted = user?.kycStatus === "SUBMITTED";
  const isKycApproved = user?.kycStatus === "APPROVED";
  const isKycRejected = user?.kycStatus === "REJECTED";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome back{displayName ? `, ${displayName}` : ""}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{user?.email ?? ""}</p>
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
              We are reviewing your documents. This usually takes few minutes.
              We will notify you once it is done.
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

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ActionCard
          title="Wallet Balance"
          description="$ 0.00"
          locked={!isKycApproved}
          onClick={() => router.push("/wallet")}
          icon={<Wallet className="w-6 h-6" />}
        />
        <ActionCard
          title="Beneficiaries"
          description="Manage recipients"
          locked={!isKycApproved}
          onClick={() => router.push("/beneficiaries")}
          icon={<Users className="w-6 h-6" />}
        />
        <ActionCard
          title="Send Money"
          description="Transfer funds internationally"
          locked={!isKycApproved}
          onClick={() => router.push("/send-money")}
          icon={<Send className="w-6 h-6" />}
        />
        {/* <ActionCard
          title="Transactions"
          description="View your transfer history"
          locked={!isKycApproved}
          onClick={() => router.push("/transactions")}
        /> */}
      </div>

      {/* Transaction history — reused table; no pagination, link to full list */}
      {isKycApproved ? (
        <DashboardTransactionHistory />
      ) : (
        <section className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
          <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden />
          <p className="text-sm text-slate-600">
            Complete verification to view your transaction history here.
          </p>
          <button
            type="button"
            onClick={() => router.push("/onboarding/profile")}
            className="cursor-pointer mt-3 text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            Go to onboarding
          </button>
        </section>
      )}
    </div>
  );
}

// ── Helper components ──

function ActionCard({
  title,
  description,
  locked,
  onClick,
  icon,
}: {
  title: string;
  description: string;
  locked: boolean;
  onClick: () => void;
  icon: React.ReactNode;
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
      <div className="flex items-start align-center">
        <div>
          {icon && (
            <div className="w-8 h-8 mr-1 text-teal-500 pt-1">{icon}</div>
          )}
        </div>
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
