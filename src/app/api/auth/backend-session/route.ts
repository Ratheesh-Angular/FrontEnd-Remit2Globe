import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

  const store = await cookies();
  store.set(TOKEN, token, {
    ...cookieBase(),
    maxAge: 7 * 24 * 60 * 60,
  });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(TOKEN);
  return NextResponse.json({ success: true });
}
