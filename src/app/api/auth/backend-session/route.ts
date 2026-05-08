import { NextResponse } from "next/server";
import { sessionCookieBase } from "@/lib/session-cookie";

const TOKEN = "token";

/** Mirrors backend JWT into an httpOnly cookie on the Next.js origin (required when API is on another host). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const token =
    typeof body === "object" &&
    body !== null &&
    "token" in body &&
    typeof (body as { token: unknown }).token === "string"
      ? (body as { token: string }).token.trim()
      : "";
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Missing token" },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(TOKEN, token, {
    ...sessionCookieBase(req),
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE(req: Request) {
  const res = NextResponse.json({ success: true });
  res.cookies.set(TOKEN, "", {
    ...sessionCookieBase(req),
    maxAge: 0,
  });
  return res;
}
