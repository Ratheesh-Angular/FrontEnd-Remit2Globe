"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { getSession } from "next-auth/react";
import { isAxiosError } from "axios";
import { useAuthStore, type AuthUser } from "@/store/auth.store";
import { sessionApi as api } from "@/lib/api";
import Link from "next/link";

function applySessionUser(
  su: NonNullable<Session["user"]> & { id?: string },
  setUser: (user: AuthUser | null) => void,
) {
  if (!su?.id) return false;
  setUser({
    id: su.id,
    email: su.email ?? null,
    phone: null,
    role: (su.role as AuthUser["role"]) || "INDIVIDUAL",
    kycStatus: (su.kycStatus as AuthUser["kycStatus"]) || "PENDING",
    createdAt: su.createdAt ?? new Date().toISOString(),
  });
  return true;
}

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
        if (initialSession?.user && applySessionUser(initialSession.user, setUser)) {
          return;
        }

        const session = await getSession();
        if (session?.user && applySessionUser(session.user, setUser)) {
          return;
        }

        const res = await api.get("/auth/me");
        const u = res.data?.data?.user;
        if (!u?.id) throw new Error("Invalid /auth/me payload");
        setUser(u as AuthUser);
      } catch (e) {
        const retry = await getSession();
        if (retry?.user && applySessionUser(retry.user, setUser)) {
          return;
        }
        if (isAxiosError(e)) {
          const status = e.response?.status;
          if (status === 401 || status === 403) {
            window.location.assign("/login");
            return;
          }
          console.error("[OnboardingLayoutClient] /auth/me failed", status, e.message);
          setSessionBanner(
            status
              ? `Could not verify your session (HTTP ${status}). Try refreshing the page.`
              : "Could not reach the server. Check your connection, then refresh.",
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
          <div className="w-7 h-7 bg-teal-600 rounded-lg" />
          <span className="font-semibold text-slate-900">Remit2Globe</span>
        </div>

        <Link
          aria-label="Back to Dashboard"
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to Dashboard
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
            className="underline font-medium text-teal-800 hover:text-teal-900"
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
