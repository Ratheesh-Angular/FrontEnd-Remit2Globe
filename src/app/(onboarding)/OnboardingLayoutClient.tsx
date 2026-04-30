"use client";

import { useEffect } from "react";
import type { Session } from "next-auth";
import { getSession } from "next-auth/react";
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
        setUser(res.data.data.user);
      } catch {
        const retry = await getSession();
        if (retry?.user && applySessionUser(retry.user, setUser)) {
          return;
        }
        window.location.href = "/login";
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

      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
