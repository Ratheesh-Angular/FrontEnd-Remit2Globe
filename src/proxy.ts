import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/register", "/forgot-password"];
const protectedRoutes = [
  "/dashboard",
  "/onboarding",
  "/send-money",
  "/transactions",
  "/beneficiaries",
  "/profile",
];

function hasNextAuthSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (c) =>
        c.name === "next-auth.session-token" ||
        c.name.startsWith("next-auth.session-token.") ||
        c.name === "__Secure-next-auth.session-token" ||
        c.name.startsWith("__Secure-next-auth.session-token."),
    );
}

export function proxy(request: NextRequest) {
  const backendToken = request.cookies.get("token")?.value;
  const hasNa = hasNextAuthSessionCookie(request);
  const authed = Boolean(backendToken) || hasNa;
  const { pathname } = request.nextUrl;

  if (!authed && protectedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Only skip /login and /register when NextAuth is active. Backend `token` alone
  // must not force /register → /dashboard (dashboard RSC uses getServerSession, not `token`).
  if (hasNa && publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
