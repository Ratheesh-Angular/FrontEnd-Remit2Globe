"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { sessionApi as api } from "@/lib/api";
import {
  clearStaleAuthAndRedirect,
  extractAuthMeUser,
  getErrorMessage,
  getHttpErrorStatus,
  isStaleAuthHttpStatus,
  safeGetSession,
} from "@/lib/load-session-client";
import { FlexLogo } from "@/components/brand/FlexLogo";
import { ArrowLeftIcon } from "lucide-react";
export default function OnboardingLayoutClient({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}) {
  const { setUser, setLoading } = useAuthStore();
  const [sessionBanner, setSessionBanner] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const naSession = initialSession ?? (await safeGetSession());
        if (naSession?.user?.id) {
          const syncRes = await fetch("/api/auth/sync-backend-session", {
            method: "POST",
            credentials: "same-origin",
          });
          if (
            !syncRes.ok &&
            syncRes.status !== 204 &&
            isStaleAuthHttpStatus(syncRes.status)
          ) {
            await clearStaleAuthAndRedirect("/login");
            return;
          }
        }

        const res = await api.get("/auth/me");
        const u = extractAuthMeUser(res.data);
        if (!u) {
          console.error(
            "[OnboardingLayoutClient] unexpected /auth/me shape",
            res.data,
          );
          if (naSession?.user?.id) {
            await clearStaleAuthAndRedirect("/login");
            return;
          }
          setSessionBanner("");
          return;
        }
        setUser(u);
      } catch (e) {
        const status = getHttpErrorStatus(e);
        if (isStaleAuthHttpStatus(status)) {
          const retry = await safeGetSession();
          const hasNextAuth = Boolean(
            initialSession?.user?.id ?? retry?.user?.id,
          );
          if (hasNextAuth) {
            await clearStaleAuthAndRedirect("/login");
            return;
          }
          setSessionBanner(
            `Could not verify your session (HTTP ${status}). Try refreshing the page.`,
          );
          return;
        }
        const retry = await safeGetSession();
        if (retry?.user?.id) {
          try {
            const res = await api.get("/auth/me");
            const u = extractAuthMeUser(res.data);
            if (u) {
              setUser(u);
              return;
            }
          } catch {
            /* fall through */
          }
          await clearStaleAuthAndRedirect("/login");
          return;
        }
        if (status !== undefined) {
          console.error(
            "[OnboardingLayoutClient] /auth/me failed",
            status,
            getErrorMessage(e),
          );
          setSessionBanner(
            `Could not verify your session (HTTP ${status}). Try refreshing the page.`,
          );
          return;
        }
        const msg = getErrorMessage(e);
        const code =
          e && typeof e === "object" && "code" in e
            ? String((e as { code?: unknown }).code ?? "")
            : "";
        if (
          code === "ERR_NETWORK" ||
          (typeof msg === "string" && msg.includes("Network Error"))
        ) {
          setSessionBanner(
            "Could not reach the server. Check your connection, then refresh.",
          );
          return;
        }
        console.error("[OnboardingLayoutClient] session load error", e);
        setSessionBanner(
          "Something went wrong loading your account. Try refreshing.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [setUser, setLoading, initialSession]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlexLogo className="h-8 max-w-[7.5rem]" priority />
        </div>

        <Link
          aria-label="Back to Dashboard"
          href="/dashboard"
          className="cursor-pointer flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="text-sm text-slate-500 hover:text-slate-700">
            Back to Dashboard
          </span>
        </Link>
      </header>

      {sessionBanner && (
        <div
          role="alert"
          className="max-w-2xl mx-auto px-4 pt-4 text-sm rounded-lg border border-amber-200 bg-amber-50 py-3 text-amber-950"
        >
          {sessionBanner}{" "}
          <button
            type="button"
            className="underline font-medium text-red-800 hover:text-red-900"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
