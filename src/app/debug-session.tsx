"use client";

import { useEffect } from "react";

const DEBUG_INGEST =
  "http://127.0.0.1:7383/ingest/6dbe9d87-e044-436d-abf2-95c045aeee0e";

/** Fires once on client mount to detect hydration / chunk load (hypothesis H3). */
export function DebugClientMountBeacon({ runId = "pre-fix" }: { runId?: string }) {
  useEffect(() => {
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
        hypothesisId: "H3",
        location: "debug-session.tsx:DebugClientMountBeacon",
        message: "root client tree mounted",
        data: {
          href: window.location.href,
          origin: window.location.origin,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [runId]);
  return null;
}
