"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { getSession, signOut as nextAuthSignOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import type { AuthUser } from "@/store/auth.store";
import { sessionApi as api } from "@/lib/api";
import { FlexLogo } from "@/components/brand/FlexLogo";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { useRef } from "react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification } from "@/types/notification";
import {
  clearStaleAuthAndRedirect,
  extractAuthMeUser,
  getErrorMessage,
  getHttpErrorStatus,
  isStaleAuthHttpStatus,
  safeGetSession,
} from "@/lib/load-session-client";
import { mergeAuthUser } from "@/lib/auth-user";
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

export default function DashboardLayoutClient({
  children,
  initialSession,
  initialUser,
}: {
  children: React.ReactNode;
  initialSession: Session | null;
  initialUser: AuthUser | null;
}) {
  const { user, setUser, setLoading } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionBanner, setSessionBanner] = useState<string | null>(null);
  const pathname = usePathname();
  const effectiveUser = user ?? initialUser;
  const isKycApproved = effectiveUser?.kycStatus === "APPROVED";
  const router = useRouter();
  useEffect(() => {
    if (initialUser) {
      const current = useAuthStore.getState().user;
      if (
        !current ||
        current.id !== initialUser.id ||
        current.kycStatus !== initialUser.kycStatus
      ) {
        setUser(initialUser);
      }
    }

    const fetchUser = async () => {
      try {
        const naSession = initialSession ?? (await safeGetSession());
        const nextAuthUserId = naSession?.user?.id;

        if (nextAuthUserId && !initialUser) {
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
            "[DashboardLayoutClient] unexpected /auth/me shape",
            res.data,
          );
          if (nextAuthUserId && !initialUser) {
            await clearStaleAuthAndRedirect("/login");
            return;
          }
          if (initialUser) setUser(initialUser);
          setSessionBanner("");
          return;
        }
        setUser(mergeAuthUser(useAuthStore.getState().user ?? initialUser, u));
      } catch (e) {
        const status = getHttpErrorStatus(e);
        if (isStaleAuthHttpStatus(status)) {
          if (initialUser) {
            setSessionBanner(
              `Could not verify your session (HTTP ${status}). Try refreshing the page.`,
            );
            return;
          }
          const retry = await safeGetSession();
          const hasNextAuth = Boolean(
            initialSession?.user?.id ?? retry?.user?.id,
          );
          if (hasNextAuth) {
            await clearStaleAuthAndRedirect("/login");
            return;
          }
          await clearStaleAuthAndRedirect("/login");
          return;
        }
        const retry = await safeGetSession();
        if (retry?.user?.id && !initialUser) {
          try {
            const res = await api.get("/auth/me");
            const u = extractAuthMeUser(res.data);
            if (u) {
              setUser(
                mergeAuthUser(useAuthStore.getState().user ?? initialUser, u),
              );
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
  }, [
    setUser,
    setLoading,
    initialSession,
    initialUser?.id,
    initialUser?.kycStatus,
    pathname,
  ]);

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

  const [notifOpen, setNotifOpen] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const { count: unreadCount, refresh: refreshCount } = useUnreadCount();
  const { notifications: previewNotifs, refresh: refreshNotifs } =
    useNotifications(1, 5);

  // Close on click outside
  useEffect(() => {
    if (!notifOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        notifMenuRef.current &&
        !notifMenuRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  async function handleMarkNotifRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      refreshCount();
      refreshNotifs();
    } catch {
      /* silent */
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch("/notifications/read-all");
      refreshCount();
      refreshNotifs();
    } catch {
      /* silent */
    }
  }

  function notifTimeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

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
        <div className="border-b border-slate-200">
          <div className="flex justify-center mb-4 mt-4 ">
            <FlexLogo className="h-8 max-w-[7.5rem]" priority />
          </div>
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
                      ? "bg-red-50 text-red-700"
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
        <header
          className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 lg:px-6 bg-white border-b border-slate-200"
          style={{ height: "93px" }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-600 p-1 -ml-1 rounded-md hover:bg-slate-100"
            aria-label="Open menu"
          >
            ☰
          </button>

          <div className="hidden lg:block flex-1 min-w-0" aria-hidden />

          <div className="flex items-center gap-2 sm:gap-3 min-w-0 ml-auto">
            {/* Notification Icon + Menu */}
            <div className="relative flex items-center">
              <button
                type="button"
                className="p-2 rounded-full hover:bg-red-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-200 relative"
                aria-label="Open notifications"
                id="notif-icon-btn"
                onClick={() => setNotifOpen((open) => !open)}
              >
                <Bell className="w-6 h-6 text-red-600" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-xs font-semibold border border-white shadow"
                    style={{ minWidth: "20px", textAlign: "center" }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <div
                ref={notifMenuRef}
                className={`
                  absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-40
                  transition-all duration-300 ease-in-out
                  ${notifOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-3 pointer-events-none"}
                `}
                style={{ boxShadow: "0 8px 32px 0 rgba(0,0,0,0.14)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <span className="font-semibold text-slate-900">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification items */}
                <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {previewNotifs.length === 0 ? (
                    <li className="py-6 text-center text-sm text-slate-400">
                      No notifications yet.
                    </li>
                  ) : (
                    previewNotifs.map((n: Notification) => (
                      <li key={n.id}>
                        <Link
                          href={`/notifications/${n.id}`}
                          onClick={() => {
                            if (!n.isRead) void handleMarkNotifRead(n.id);
                            setNotifOpen(false);
                          }}
                          className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${!n.isRead ? "bg-red-50/40" : ""}`}
                        >
                          {!n.isRead && (
                            <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-red-500" />
                          )}
                          <div
                            className={`flex-1 min-w-0 ${n.isRead ? "ml-5" : ""}`}
                          >
                            <p
                              className={`text-sm truncate ${!n.isRead ? "font-semibold text-slate-900" : "text-slate-700"}`}
                            >
                              {n.title}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {n.body}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {notifTimeAgo(n.createdAt)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>

                {/* Footer */}
                <div className="border-t border-slate-100 px-4 py-2.5">
                  <Link
                    href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="block text-center text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            </div>

            <div
              onClick={() => router.push("/profile")}
              className="cursor-pointer flex items-center gap-2.5 sm:gap-3 min-w-0 px-1"
            >
              <div className=" w-8 h-8 shrink-0 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-sm font-medium">
                {effectiveUser?.email?.[0]?.toUpperCase() ||
                  effectiveUser?.phone?.[0] ||
                  "U"}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="text-sm font-medium text-slate-900 truncate max-w-[12rem] md:max-w-[16rem]">
                  {effectiveUser?.name ||
                    effectiveUser?.email ||
                    effectiveUser?.phone ||
                    "User"}
                </p>
                <p className="text-xs text-slate-500 capitalize truncate">
                  {effectiveUser?.role?.toLowerCase()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer flex items-center gap-2 px-2.5 sm:px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
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
              className="underline font-medium text-red-800 hover:text-red-900"
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
