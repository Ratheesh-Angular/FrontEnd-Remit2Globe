"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sessionApi as api } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";

type ViewState =
  | "checking"
  | "processing"
  | "paid"
  | "pending"
  | "cancelled"
  | "failed"
  | "error";

function PaymentReturnInner() {
  const searchParams = useSearchParams();
  const outcomeHint = searchParams.get("outcome");
  const transferId = searchParams.get("transferId");

  const [state, setState] = useState<ViewState>("checking");
  const [message, setMessage] = useState("Checking your card payment…");
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const poll = useCallback(async () => {
    if (!transferId) {
      if (outcomeHint === "cancelled") {
        setState("cancelled");
        setMessage("Card payment was cancelled. You can retry from Transactions.");
        return;
      }
      setState("error");
      setMessage("Missing transfer reference. Open Transactions to check status.");
      return;
    }

    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Prefer Selcom status sync (polls gateway if still pending)
        try {
          await api.get(
            `/remittance/transfers/${transferId}/card-payment-status`,
          );
        } catch {
          /* fall through to transfer GET */
        }

        const res = await api.get<{
          data: {
            transfer: {
              referenceCode?: string;
              status?: string;
              failureReason?: string | null;
              selcomPaymentStatus?: string | null;
            };
          };
        }>(`/remittance/transfers/${transferId}`);

        const t = res.data.data.transfer;
        setReferenceCode(t.referenceCode ?? null);
        setFailureReason(t.failureReason ?? null);

        const status = String(t.status ?? "").toUpperCase();
        if (
          status === "PROCESSING" ||
          status === "COMPLETED" ||
          status === "UNDER_REVIEW" ||
          status === "PAYMENT_SUBMITTED"
        ) {
          setState(status === "COMPLETED" ? "paid" : "processing");
          setMessage(
            status === "COMPLETED"
              ? "Payment received. Your transfer is complete."
              : "Payment received. We are processing your transfer to the beneficiary.",
          );
          return;
        }

        if (status === "FAILED") {
          setState("failed");
          setMessage(
            t.failureReason?.trim() ||
              "Card payment failed. You can retry from Transactions.",
          );
          return;
        }

        if (status === "CANCELLED") {
          setState("cancelled");
          setMessage("This transfer was cancelled.");
          return;
        }

        // Still PENDING_PAYMENT
        if (outcomeHint === "cancelled") {
          setState("cancelled");
          setMessage(
            "Card payment was cancelled. Your transfer is still awaiting payment — you can retry anytime.",
          );
          return;
        }

        setState("pending");
        setMessage(
          "Payment is still pending. If you completed checkout, wait a moment or check Transactions.",
        );
      } catch {
        if (i === maxAttempts - 1) {
          setState("error");
          setMessage("Could not load payment status. Check Transactions.");
          return;
        }
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    if (outcomeHint === "cancelled") {
      setState("cancelled");
      setMessage("Card payment was cancelled.");
    } else {
      setState("pending");
      setMessage(
        "We have not confirmed payment yet. Check Transactions in a minute.",
      );
    }
  }, [outcomeHint, transferId]);

  useEffect(() => {
    void poll();
  }, [poll]);

  const tone =
    state === "paid" || state === "processing"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : state === "cancelled" || state === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : state === "failed" || state === "error"
          ? "border-red-200 bg-red-50 text-red-950"
          : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
        Card payment
      </h1>
      {referenceCode ? (
        <p className="text-sm text-slate-500 mt-1 font-mono">{referenceCode}</p>
      ) : null}

      <div className={`mt-6 rounded-xl border px-4 py-4 text-sm ${tone}`}>
        {state === "checking" ? (
          <div className="flex items-center gap-3">
            <Loader variant="inline" label="" />
            <span>{message}</span>
          </div>
        ) : (
          <>
            <p className="font-medium">{message}</p>
            {failureReason && state === "failed" ? (
              <p className="mt-2 text-xs opacity-90">{failureReason}</p>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-2">
        <Link
          href="/transactions"
          className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-medium inline-flex items-center justify-center hover:bg-red-700"
        >
          View transactions
        </Link>
        <Link
          href="/send-money"
          className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium inline-flex items-center justify-center hover:bg-slate-50"
        >
          Send money again
        </Link>
        {(state === "cancelled" || state === "failed" || state === "pending") &&
        transferId ? (
          <button
            type="button"
            className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 cursor-pointer"
            onClick={() => {
              void (async () => {
                try {
                  const res = await api.post<{
                    data: { paymentGatewayUrl?: string };
                  }>(`/remittance/transfers/${transferId}/retry-card-payment`);
                  const url = res.data.data.paymentGatewayUrl?.trim();
                  if (url) window.location.assign(url);
                } catch {
                  setMessage(
                    "Could not restart card payment. Try again from Transactions.",
                  );
                  setState("error");
                }
              })();
            }}
          >
            Retry card payment
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function CardPaymentReturnPage() {
  return (
    <Suspense
      fallback={<Loader variant="page" label="Loading payment result…" />}
    >
      <PaymentReturnInner />
    </Suspense>
  );
}
