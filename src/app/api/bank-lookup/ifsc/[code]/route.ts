import { NextResponse } from "next/server";

const IFSC_PATH_RE = /^[A-Z0-9]{11}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await context.params;
  const code = String(raw ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

  if (!IFSC_PATH_RE.test(code)) {
    return NextResponse.json({ error: "invalid_ifsc" }, { status: 400 });
  }

  const upstream = await fetch(`https://ifsc.razorpay.com/${code}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });

  if (upstream.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }

  const data = (await upstream.json()) as Record<string, unknown>;
  return NextResponse.json({
    bank: String(data.BANK ?? ""),
    branch: String(data.BRANCH ?? ""),
    swift: data.SWIFT != null ? String(data.SWIFT) : undefined,
    ifsc: String(data.IFSC ?? code),
  });
}
