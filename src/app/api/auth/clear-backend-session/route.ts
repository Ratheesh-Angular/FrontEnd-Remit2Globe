import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { redirectToAppPath } from "@/lib/app-url";
import { sessionCookieBase } from "@/lib/session-cookie";

const TOKEN = "token";

/** NextAuth v4 cookie names (dev http + production https variants). */
const NEXT_AUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
] as const;

function safeCallbackPath(raw: string | null): string {
  const callbackUrl = raw ?? "/register";
  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/register";
}

function shouldClearNextAuth(req: NextRequest): boolean {
  return (
    req.nextUrl.searchParams.get("nextAuth") === "1" ||
    req.nextUrl.searchParams.get("nextAuth") === "true"
  );
}

function applySessionClear(res: NextResponse, req: NextRequest): void {
  res.cookies.set(TOKEN, "", {
    ...sessionCookieBase(req),
    maxAge: 0,
  });
  if (shouldClearNextAuth(req)) {
    const base = sessionCookieBase(req);
    for (const name of NEXT_AUTH_COOKIE_NAMES) {
      res.cookies.set(name, "", { ...base, maxAge: 0 });
    }
  }
}

export async function GET(req: NextRequest) {
  const safeCallback = safeCallbackPath(
    req.nextUrl.searchParams.get("callbackUrl"),
  );
  const res = redirectToAppPath(req, safeCallback);
  applySessionClear(res, req);
  return res;
}

/** Clear cookies without a Location redirect (client navigates on same host). */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  applySessionClear(res, req);
  return res;
}
