import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sessionCookieBase } from "@/lib/session-cookie";

const TOKEN = "token";

export async function GET(req: NextRequest) {
  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") ?? "/register";
  const safeCallback =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/register";

  const res = NextResponse.redirect(new URL(safeCallback, req.url));
  res.cookies.set(TOKEN, "", {
    ...sessionCookieBase(req),
    maxAge: 0,
  });
  return res;
}
