"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sessionApi as api } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000;

export function useUnreadCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: { count: number } }>(
        "/notifications/unread-count",
      );
      if (res.data?.success) {
        setCount(res.data.data.count);
      }
    } catch {
      // Silent — badge simply doesn't update on transient failures
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCount();
    timerRef.current = setInterval(() => void fetchCount(), POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCount]);

  return { count, loading, refresh: fetchCount };
}
