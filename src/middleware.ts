import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/onboarding",
  "/send-money",
  "/transactions",
  "/beneficiaries",
  "/profile",
];

export default async function middleware(request: NextRequest) {
  const backendToken = request.cookies.get("token")?.value;
  const naToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const hasNa = Boolean(naToken?.sub);
  const authed = Boolean(backendToken) || hasNa;
  const { pathname } = request.nextUrl;

  if (!authed && protectedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Only skip /login when NextAuth JWT is valid. Do not redirect /register — stale
  // cookies must not block Google signup after a DB user delete.
  if (hasNa && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
