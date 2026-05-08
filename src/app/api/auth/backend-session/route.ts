import { NextResponse } from "next/server";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { sessionCookieBase, sessionCookieSecure } from "@/lib/session-cookie";

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

  const resolvedSecure = sessionCookieSecure();
  // #region agent log
  try {
    const logLine =
      JSON.stringify({
        sessionId: "365919",
        runId: "post-fix",
        hypothesisId: "H2",
        location: "backend-session/route.ts:POST",
        message: "setting token cookie",
        data: {
          secureCookieFlag: resolvedSecure,
          nodeEnv: process.env.NODE_ENV ?? "",
          nextauthScheme: (process.env.NEXTAUTH_URL?.trim() ?? "").split(":")[0] ?? "",
        },
        timestamp: Date.now(),
      }) + "\n";
    appendFileSync(
      path.join(process.cwd(), "..", "debug-365919.log"),
      logLine,
      { flag: "a" },
    );
  } catch {
    /* ignore missing path on deployed hosts */
  }
  void fetch(
    "http://127.0.0.1:7383/ingest/6dbe9d87-e044-436d-abf2-95c045aeee0e",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "365919",
      },
      body: JSON.stringify({
        sessionId: "365919",
        runId: "post-fix",
        hypothesisId: "H2",
        location: "backend-session/route.ts:POST",
        message: "setting token cookie",
        data: {
          secureCookieFlag: resolvedSecure,
          nodeEnv: process.env.NODE_ENV ?? "",
          nextauthScheme: (process.env.NEXTAUTH_URL?.trim() ?? "").split(":")[0] ?? "",
        },
        timestamp: Date.now(),
      }),
    },
  ).catch(() => {});
  // #endregion

  const res = NextResponse.json({ success: true });
  res.cookies.set(TOKEN, token, {
    ...sessionCookieBase(),
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(TOKEN, "", {
    ...sessionCookieBase(),
    maxAge: 0,
  });
  return res;
}
