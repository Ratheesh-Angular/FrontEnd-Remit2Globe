"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { getSession, signOut as nextAuthSignOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore, type AuthUser } from "@/store/auth.store";
import { sessionApi as api } from "@/lib/api";
import {
  extractAuthMeUser,
  getErrorMessage,
  getHttpErrorStatus,
  safeGetSession,
} from "@/lib/load-session-client";
import {
  LayoutDashboard,
  Send,
  ArrowLeftRight,
  Users,
  User,
  LogOut,
  Lock,
} from "lucide-react";

const navItems: {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** When true, only enabled if KYC is APPROVED (same rules as dashboard quick actions). */
  requiresKyc?: boolean;
}[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Beneficiaries",
    href: "/beneficiaries",
    icon: Users,
    requiresKyc: true,
  },
  {
    label: "Send Money",
    href: "/send-money",
    icon: Send,
    requiresKyc: true,
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: ArrowLeftRight,
    requiresKyc: true,
  },

  {
    label: "Profile",
    href: "/profile",
    icon: User,
  },
];

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

export default function DashboardLayoutClient({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}) {
  const { user, setUser, setLoading } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionBanner, setSessionBanner] = useState<string | null>(null);
  const pathname = usePathname();
  const isKycApproved = user?.kycStatus === "APPROVED";

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const naSession =
          initialSession ?? (await safeGetSession());
        if (naSession?.user) {
          await fetch("/api/auth/sync-backend-session", {
            method: "POST",
            credentials: "same-origin",
          });
        }

        if (
          naSession?.user &&
          applySessionUser(naSession.user, setUser)
        ) {
          return;
        }

        const res = await api.get("/auth/me");
        const u = extractAuthMeUser(res.data);
        if (!u) {
          console.error(
            "[DashboardLayoutClient] unexpected /auth/me shape",
            res.data,
          );
          setSessionBanner(
            // "Could not read your account data. Try refreshing the page.",
            "",
          );
          return;
        }
        setUser(u);
      } catch (e) {
        const retry = await safeGetSession();
        if (retry?.user && applySessionUser(retry.user, setUser)) {
          return;
        }
        const status = getHttpErrorStatus(e);
        if (status !== undefined) {
          if (status === 401 || status === 403) {
            window.location.assign("/login");
            return;
          }
          console.error(
            "[DashboardLayoutClient] /auth/me failed",
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
        console.error("[DashboardLayoutClient] session load error", e);
        setSessionBanner(
          "Something went wrong loading your account. Try refreshing.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [setUser, setLoading, initialSession]);

  const handleLogout = async () => {
    const session = await getSession();
    if (session) {
      await nextAuthSignOut({ redirect: false });
    }
    try {
      await api.post("/auth/logout");
    } catch {
      /* cookie may already be gone */
    }
    try {
      await fetch("/api/auth/backend-session", {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200
        transform transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:translate-x-0 lg:flex lg:flex-col
      `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-200">
          <div className="w-7 h-7 bg-teal-600 rounded-lg" />
          <span className="font-semibold text-slate-900">Remit2Globe</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const locked = Boolean(item.requiresKyc && !isKycApproved);
            const isActive = !locked && pathname === item.href;
            if (locked) {
              return (
                <div
                  key={item.href}
                  title="Complete identity verification to unlock"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed opacity-60"
                  aria-disabled
                >
                  <span className="text-base shrink-0">
                    <item.icon className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">{item.label}</span>
                  <Lock
                    className="w-4 h-4 shrink-0 text-slate-300"
                    aria-hidden
                  />
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }
                `}
              >
                <span className="text-base">
                  <item.icon className="w-5 h-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-medium">
              {user?.email?.[0]?.toUpperCase() || user?.phone?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.email || user?.phone || "User"}
              </p>
              <p className="text-xs text-slate-500 capitalize">
                {user?.role?.toLowerCase()}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <span>
              <LogOut className="w-5 h-5" />
            </span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-4 bg-white border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-teal-600 rounded" />
            <span className="font-semibold text-slate-900 text-sm">
              Remit2Globe
            </span>
          </div>
        </header>

        {sessionBanner && (
          <div
            role="alert"
            className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
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

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
