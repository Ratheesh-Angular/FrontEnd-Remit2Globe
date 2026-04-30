import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getBackendApiBase } from "@/lib/backend-api-base";

const TOKEN_COOKIE = "token";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

async function proxyToBackend(req: NextRequest, pathSegments: string[]) {
  if (pathSegments.length === 0) {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }

  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Not authenticated. Please login." },
      { status: 401 },
    );
  }

  const base = getBackendApiBase().replace(/\/+$/, "");
  const target = new URL(`${base}/${pathSegments.join("/")}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const incoming = req.headers;
  const forwardHeaders = new Headers();
  forwardHeaders.set("Cookie", `${TOKEN_COOKIE}=${token}`);

  const contentType = incoming.get("content-type");
  if (contentType) forwardHeaders.set("Content-Type", contentType);

  const accept = incoming.get("accept");
  if (accept) forwardHeaders.set("Accept", accept);

  const method = req.method;
  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) body = buf;
  }

  const upstream = await fetch(target.toString(), {
    method,
    headers: forwardHeaders,
    body,
    cache: "no-store",
  });

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "set-cookie") return;
    out.append(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyToBackend(req, path);
}

export async function HEAD(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyToBackend(req, path);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyToBackend(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyToBackend(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyToBackend(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyToBackend(req, path);
}
