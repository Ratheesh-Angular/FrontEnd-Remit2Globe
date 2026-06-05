"use client";

import { useCallback, useEffect, useState } from "react";
import { sessionApi as api } from "@/lib/api";
import type { Notification, NotificationPagination } from "@/types/notification";

interface UseNotificationsResult {
  notifications: Notification[];
  pagination: NotificationPagination | null;
  loading: boolean;
  error: string;
  refresh: () => void;
}

export function useNotifications(
  page = 1,
  limit = 20,
): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<NotificationPagination | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .get<{
        success: boolean;
        data: {
          notifications: Notification[];
          pagination: NotificationPagination;
        };
      }>(`/notifications?page=${page}&limit=${limit}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success) {
          setNotifications(res.data.data.notifications);
          setPagination(res.data.data.pagination);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load notifications.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, limit, tick]);

  return { notifications, pagination, loading, error, refresh };
}
