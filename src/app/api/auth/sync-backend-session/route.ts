import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  backendFetchResolutionMessage,
  BACKEND_FETCH_TIMEOUT_MS,
  resolveBackendFetchBase,
} from "@/lib/backend-api-base";
import { backendOutboundFetch } from "@/lib/backend-outbound-fetch";

export const runtime = "nodejs";

const TOKEN = "token";

function cookieBase() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

/** Issues backend JWT onto the Next origin when NextAuth exists but mirrored `token` is missing or must be refreshed. */
export async function POST(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const jar = await cookies();
  if (!force && jar.get(TOKEN)?.value) {
    return new NextResponse(null, { status: 204 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim();
  if (!userId) {
    /** No NextAuth: password-backed users rely on mirrored `token` only — allow benign POST. */
    if (force) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 },
      );
    }
    return new NextResponse(null, { status: 204 });
  }

  const secret = process.env.INTERNAL_FRONTEND_AUTH_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Server misconfigured: INTERNAL_FRONTEND_AUTH_SECRET is not set.",
      },
      { status: 503 },
    );
  }

  const resolved = resolveBackendFetchBase();
  if (!resolved.ok) {
    console.error("[sync-backend-session] misconfigured:", resolved.reason);
    return NextResponse.json(
      {
        success: false,
        message: backendFetchResolutionMessage(resolved),
      },
      { status: 503 },
    );
  }

  const base = resolved.baseUrl.replace(/\/+$/, "");
  const url = `${base}/auth/internal/trusted-session`;
  let upstream: Response;
  try {
    upstream = await backendOutboundFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth": secret,
      },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(BACKEND_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[sync-backend-session] upstream fetch failed:", url, err);
    return NextResponse.json(
      {
        success: false,
        message:
          "Could not reach the API server. Set BACKEND_API_URL or NEXT_PUBLIC_API_URL.",
      },
      { status: 502 },
    );
  }

  const body = (await upstream.json().catch(() => null)) as {
    success?: boolean;
    data?: { token?: string };
    message?: string;
  } | null;

  if (!upstream.ok || !body?.success || !body.data?.token) {
    return NextResponse.json(
      {
        success: false,
        message: body?.message || "Could not establish backend session.",
      },
      { status: upstream.status >= 400 ? upstream.status : 502 },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(TOKEN, body.data.token, {
    ...cookieBase(),
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
