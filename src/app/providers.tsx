"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { DebugClientMountBeacon } from "./debug-session";

const DEBUG_INGEST =
  "http://127.0.0.1:7383/ingest/6dbe9d87-e044-436d-abf2-95c045aeee0e";

function SessionRouteProbe({ runId = "pre-fix" }: { runId?: string }) {
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { credentials: "same-origin" }).then(
      (r) => {
        if (cancelled) return;
        // #region agent log
        fetch(DEBUG_INGEST, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "365919",
          },
          body: JSON.stringify({
            sessionId: "365919",
            runId,
            hypothesisId: "H5",
            location: "providers.tsx:SessionRouteProbe",
            message: "GET /api/auth/session finished",
            data: {
              status: r.status,
              ok: r.ok,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      },
    );
    return () => {
      cancelled = true;
    };
  }, [runId]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DebugClientMountBeacon runId="pre-fix" />
      <SessionRouteProbe runId="pre-fix" />
      {children}
    </SessionProvider>
  );
}
