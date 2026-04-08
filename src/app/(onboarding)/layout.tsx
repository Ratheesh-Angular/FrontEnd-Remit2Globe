"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import api from "@/lib/api";
import Link from "next/link";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data.data.user);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
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
