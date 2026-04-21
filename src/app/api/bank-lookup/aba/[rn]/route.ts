import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ rn: string }> },
) {
  const { rn: raw } = await context.params;
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 9);

  if (digits.length !== 9) {
    return NextResponse.json({ error: "invalid_aba" }, { status: 400 });
  }

  const upstream = await fetch(
    `https://bankrouting.io/api/v1/aba/${digits}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    },
  );

  if (!upstream.ok) {
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }

  const body = (await upstream.json()) as {
    status?: string;
    data?: { bank_name?: string; city?: string; state?: string };
  };

  if (body.status !== "success" || !body.data?.bank_name) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { bank_name, city, state } = body.data;
  return NextResponse.json({
    bank: String(bank_name),
    city: String(city ?? ""),
    state: String(state ?? ""),
  });
}
