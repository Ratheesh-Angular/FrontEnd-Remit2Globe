import { NextResponse } from "next/server";
import { getBackendApiBaseServer } from "@/lib/backend-api-base";
import { backendOutboundFetch } from "@/lib/backend-outbound-fetch";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Public proxy for landing footer — no auth required. */
export async function GET() {
  const base = getBackendApiBaseServer();

  try {
    const res = await backendOutboundFetch(`${base}/version`);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Backend version unavailable" },
        { status: 502, headers: NO_STORE },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "Backend version unavailable" },
      { status: 502, headers: NO_STORE },
    );
  }
}
