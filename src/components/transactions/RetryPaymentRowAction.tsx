"use client";

import { useState } from "react";
import { sessionApi as api } from "@/lib/api";
import {
  canRetryCardPayment,
  canRetryMobileMoneyPayment,
} from "@/lib/flex-response-codes";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { RemittanceTransferRow } from "@/lib/transfer-receipt-from-transfer";
import { AppLoadingOverlay } from "@/components/ui/AppLoadingOverlay";
import { RotateCcw } from "lucide-react";

export type RetryPaymentRowActionProps = {
  transfer: RemittanceTransferRow;
  onRetried?: () => void;
};

function retryErrorMessage(error: unknown): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? "Could not retry payment. Please try again."
  );
}

export function RetryPaymentRowAction({
  transfer,
  onRetried,
}: RetryPaymentRowActionProps) {
  const [busy, setBusy] = useState(false);
  const canRetryMm = canRetryMobileMoneyPayment(transfer);
  const canRetryCard = canRetryCardPayment(transfer);

  if (!canRetryMm && !canRetryCard) return null;

  async function handleRetry() {
    setBusy(true);
    try {
      if (canRetryCard) {
        const res = await api.post<{
          message?: string;
          data?: { paymentGatewayUrl?: string };
        }>(`/remittance/transfers/${transfer.id}/retry-card-payment`);
        const url = res.data.data?.paymentGatewayUrl?.trim();
        if (url) {
          window.location.assign(url);
          return;
        }
        notifySuccess(
          typeof res.data.message === "string"
            ? res.data.message
            : "Card payment restarted.",
        );
        onRetried?.();
        return;
      }

      const res = await api.post<{ message?: string }>(
        `/remittance/transfers/${transfer.id}/retry-payment`,
      );
      notifySuccess(
        typeof res.data.message === "string"
          ? res.data.message
          : "Check your phone to approve the mobile money payment prompt.",
      );
      onRetried?.();
    } catch (e: unknown) {
      notifyError(retryErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    "cursor-pointer inline-flex items-center gap-1 h-8 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 hover:border-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
      <AppLoadingOverlay
        show={busy}
        label={
          canRetryCard
            ? "Opening card payment…"
            : "Sending payment prompt…"
        }
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void handleRetry();
        }}
        className={buttonClass}
        title="Retry payment"
        aria-label="Retry payment"
      >
        <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span>Retry payment</span>
      </button>
    </>
  );
}
