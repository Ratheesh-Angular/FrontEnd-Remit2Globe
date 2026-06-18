"use client";

import { useCallback, useState } from "react";

export type UseAsyncActionOptions = {
  /** Shown on Loader overlay when provided via AppLoadingOverlay. */
  label?: string;
  sublabel?: string;
};

/**
 * Wraps async work with a local pending flag for Loader overlays.
 */
export function useAsyncAction(_options: UseAsyncActionOptions = {}) {
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setIsPending(true);
    try {
      return await fn();
    } finally {
      setIsPending(false);
    }
  }, []);

  return { run, isPending };
}
