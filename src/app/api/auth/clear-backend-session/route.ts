import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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

function clearNextAuthCookies(
  res: NextResponse,
  req: NextRequest,
): void {
  const base = sessionCookieBase(req);
  for (const name of NEXT_AUTH_COOKIE_NAMES) {
    res.cookies.set(name, "", { ...base, maxAge: 0 });
  }
}

export async function GET(req: NextRequest) {
  const safeCallback = safeCallbackPath(
    req.nextUrl.searchParams.get("callbackUrl"),
  );
  const clearNextAuth =
    req.nextUrl.searchParams.get("nextAuth") === "1" ||
    req.nextUrl.searchParams.get("nextAuth") === "true";

  const res = NextResponse.redirect(new URL(safeCallback, req.url));
  res.cookies.set(TOKEN, "", {
    ...sessionCookieBase(req),
    maxAge: 0,
  });
  if (clearNextAuth) {
    clearNextAuthCookies(res, req);
  }
  return res;
}
