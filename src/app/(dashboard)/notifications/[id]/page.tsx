"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sessionApi as api } from "@/lib/api";
import type { Notification, NotificationType } from "@/types/notification";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  FileText,
  ShieldCheck,
  ShieldX,
  Send,
  CreditCard,
  BadgeCheck,
} from "lucide-react";

// ── CTA config per notification type ────────────────────────────────────────
const CTA_BY_TYPE: Record<
  NotificationType,
  { label: string; href: string } | null
> = {
  REGISTRATION_SUCCESS: {
    label: "Complete Identity Verification",
    href: "/onboarding/profile",
  },
  KYC_SUBMITTED: { label: "View KYC Status", href: "/profile" },
  KYC_APPROVED: { label: "Start Sending Money", href: "/send-money" },
  KYC_REJECTED: { label: "Re-submit KYC", href: "/onboarding" },
  TRANSACTION_CREATED: { label: "View Transactions", href: "/transactions" },
  PAYMENT_INSTRUCTIONS: {
    label: "View Payment Instructions",
    href: "/transactions",
  },
  PAYMENT_RECEIVED: { label: "View Transaction", href: "/transactions" },
  TRANSACTION_COMPLETED: { label: "View Transaction", href: "/transactions" },
};

const ICON_BY_TYPE: Record<NotificationType, React.ReactNode> = {
  REGISTRATION_SUCCESS: <BadgeCheck className="w-6 h-6 text-teal-600" />,
  KYC_SUBMITTED: <FileText className="w-6 h-6 text-blue-500" />,
  KYC_APPROVED: <ShieldCheck className="w-6 h-6 text-green-500" />,
  KYC_REJECTED: <ShieldX className="w-6 h-6 text-red-500" />,
  TRANSACTION_CREATED: <Send className="w-6 h-6 text-teal-600" />,
  PAYMENT_INSTRUCTIONS: <CreditCard className="w-6 h-6 text-amber-500" />,
  PAYMENT_RECEIVED: <CheckCircle2 className="w-6 h-6 text-green-500" />,
  TRANSACTION_COMPLETED: <CheckCircle2 className="w-6 h-6 text-teal-600" />,
};

function formatMetadata(metadata: Record<string, unknown>): {
  label: string;
  value: string;
}[] {
  const labelMap: Record<string, string> = {
    email: "Email",
    transactionId: "Transaction ID",
    referenceCode: "Reference",
    amount: "Amount",
    currency: "Currency",
    payoutCurrency: "Payout Currency",
  };
  return Object.entries(metadata)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => ({
      label: labelMap[k] ?? k,
      value: String(v),
    }));
}

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        // Fetch the specific notification from the list (no dedicated GET by ID endpoint needed)
        const res = await api.get<{
          success: boolean;
          data: {
            notifications: Notification[];
            pagination: { total: number; totalPages: number };
          };
        }>(`/notifications?page=1&limit=200`);
        if (cancelled) return;
        if (res.data?.success) {
          const found = res.data.data.notifications.find((n) => n.id === id);
          if (found) {
            setNotification(found);
            // Mark as read if not already
            if (!found.isRead) {
              void api.patch(`/notifications/${id}/read`).catch(() => {});
            }
          } else {
            setError("Notification not found.");
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load notification.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto flex justify-center py-24 text-slate-400">
        Loading…
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700 mb-4">
          {error || "Notification not found."}
        </div>
        <Link
          href="/notifications"
          className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to notifications
        </Link>
      </div>
    );
  }

  const cta = CTA_BY_TYPE[notification.type];
  const icon = ICON_BY_TYPE[notification.type] ?? (
    <Bell className="w-6 h-6 text-slate-400" />
  );
  const metaRows =
    notification.metadata && typeof notification.metadata === "object"
      ? formatMetadata(notification.metadata as Record<string, unknown>)
      : [];

  const formattedDate = new Date(notification.createdAt).toLocaleString(
    undefined,
    {
      dateStyle: "long",
      timeStyle: "short",
    },
  );

  return (
    <div className="max-w-xl mx-auto">
      {/* Back link */}
      <Link
        href="/notifications"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        All notifications
      </Link>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* Icon banner */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b border-slate-50">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 leading-snug">
              {notification.title}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{formattedDate}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-slate-700 leading-relaxed">
            {notification.body}
          </p>

          {/* Metadata table */}
          {metaRows.length > 0 && (
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 px-4 py-4">
              {metaRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                    {row.label}
                  </dt>
                  <dd className="text-sm text-slate-800 font-medium mt-0.5 truncate">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* CTA */}
          {cta && (
            <div className="mt-6">
              <Link
                href={
                  /* If the type links to transactions + we have a transactionId, append it */
                  cta.href === "/transactions" &&
                  notification.metadata?.transactionId
                    ? `/transactions`
                    : cta.href
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                {cta.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
