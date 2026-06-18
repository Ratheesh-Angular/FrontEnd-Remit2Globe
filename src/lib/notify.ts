/**
 * API feedback: notifySuccess / notifyApiError (not inline divs).
 * Field validation: keep under inputs.
 * Long operations: Loader overlay via useAsyncAction or local isSaving.
 */

import { toast } from "@/hooks/useToast";

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const ax = error as {
      response?: { data?: { message?: unknown; error?: unknown } };
      message?: unknown;
    };
    const data = ax.response?.data;
    if (data && typeof data === "object") {
      if (typeof data.message === "string" && data.message.trim()) {
        return data.message;
      }
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error;
      }
    }
    if (typeof ax.message === "string" && ax.message.trim()) {
      return ax.message;
    }
  }
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function notifySuccess(message: string, title?: string) {
  toast.success(title ?? "Success", message);
}

export function notifyError(message: string, title?: string) {
  toast.error(title ?? "Error", message);
}

export function notifyInfo(message: string, title?: string) {
  toast.info(title ?? "Notice", message);
}

export function notifyApiError(error: unknown, fallback = "Something went wrong") {
  notifyError(extractApiErrorMessage(error, fallback));
}
