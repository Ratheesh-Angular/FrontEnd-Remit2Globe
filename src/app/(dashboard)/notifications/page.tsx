"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { sessionApi as api } from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import type { Notification } from "@/types/notification";
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

function groupByDate(notifications: Notification[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; items: Notification[] }[] = [
    { label: "Today", items: [] },
    { label: "This Week", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    d.setHours(0, 0, 0, 0);
    if (d >= today) {
      groups[0].items.push(n);
    } else if (d >= weekAgo) {
      groups[1].items.push(n);
    } else {
      groups[2].items.push(n);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { notifications, pagination, loading, refresh } = useNotifications(
    page,
    PAGE_SIZE,
  );
  const { count: unreadCount, refresh: refreshCount } = useUnreadCount();

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.patch("/notifications/read-all");
      refresh();
      refreshCount();
    } catch {
      /* silent */
    }
  }, [refresh, refreshCount]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        await api.patch(`/notifications/${id}/read`);
        refresh();
        refreshCount();
      } catch {
        /* silent */
      }
    },
    [refresh, refreshCount],
  );

  const groups = groupByDate(notifications);
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-teal-600" />
          <h1 className="text-2xl font-semibold text-slate-900">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-semibold rounded-full px-2 py-0.5 leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-800 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex justify-center py-16 text-slate-400">
          Loading…
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Bell className="w-12 h-12 mb-3 text-slate-200" />
          <p className="text-base font-medium">No notifications yet</p>
          <p className="text-sm mt-1">
            We&apos;ll notify you about important account activity here.
          </p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
                {group.label}
              </h2>
              <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                {group.items.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-4 ${!n.isRead ? "bg-teal-50/40" : ""}`}
                  >
                    {/* Unread dot */}
                    <div className="pt-1 shrink-0 w-2.5">
                      {!n.isRead && (
                        <span className="block w-2 h-2 rounded-full bg-teal-500" />
                      )}
                    </div>

                    {/* Body */}
                    <Link
                      href={`/notifications/${n.id}`}
                      onClick={() => {
                        if (!n.isRead) void handleMarkRead(n.id);
                      }}
                      className="flex-1 min-w-0 group"
                    >
                      <p
                        className={`text-sm group-hover:text-teal-700 transition-colors ${!n.isRead ? "font-semibold text-slate-900" : "text-slate-700"}`}
                      >
                        {n.title}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {timeLabel(n.createdAt)}
                      </p>
                    </Link>

                    {/* Mark-read button */}
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => void handleMarkRead(n.id)}
                        title="Mark as read"
                        className="shrink-0 p-1 text-slate-300 hover:text-teal-600 transition-colors"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
