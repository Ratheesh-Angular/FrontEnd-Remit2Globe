import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  backendFetchResolutionMessage,
  BACKEND_FETCH_TIMEOUT_MS,
  resolveBackendFetchBase,
} from "@/lib/backend-api-base";
import { backendOutboundFetch } from "@/lib/backend-outbound-fetch";

export const runtime = "nodejs";
/** Ensures proxied handlers always run dynamically (avoid caching / ISR surprises at the edge). */
export const dynamic = "force-dynamic";

const TOKEN_COOKIE = "token";

const BFF_NO_STORE =
  "private, no-store, max-age=0" as const;

const BFF_JSON_HEADERS = {
  "Cache-Control": BFF_NO_STORE,
} as const;

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
    return NextResponse.json(
      { success: false, message: "Not found" },
      { status: 404, headers: BFF_JSON_HEADERS },
    );
  }

  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Not authenticated. Please login." },
      { status: 401, headers: BFF_JSON_HEADERS },
    );
  }

  const resolved = resolveBackendFetchBase();
  if (!resolved.ok) {
    console.error("[api/backend] misconfigured:", resolved.reason);
    return NextResponse.json(
      { success: false, message: backendFetchResolutionMessage(resolved) },
      { status: 503, headers: BFF_JSON_HEADERS },
    );
  }

  const base = resolved.baseUrl.replace(/\/+$/, "");
  let target: URL;
  try {
    target = new URL(`${base}/${pathSegments.join("/")}`);
  } catch (e) {
    console.error("[api/backend] invalid target URL:", base, pathSegments, e);
    return NextResponse.json(
      { success: false, message: "Invalid backend proxy target URL." },
      { status: 503, headers: BFF_JSON_HEADERS },
    );
  }

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

  let upstream: Response;
  try {
    upstream = await backendOutboundFetch(target.toString(), {
      method,
      headers: forwardHeaders,
      body,
      signal: AbortSignal.timeout(BACKEND_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const hint =
      err instanceof Error ? err.message : typeof err === "string" ? err : "unknown_error";
    const errno =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      typeof (err as { code?: unknown }).code === "string"
        ? String((err as { code: string }).code)
        : undefined;
    console.error("[api/backend] upstream fetch failed:", target.hostname, errno ?? hint, err);
    const errnoHint = errno ? ` (${errno})` : "";
    const extra =
      process.env.NODE_ENV === "production"
        ? ` Set BACKEND_INTERNAL_API_URL or BACKEND_API_URL to your Express API /api root, not this site’s URL.${errnoHint}`
        : "";
    return NextResponse.json(
      {
        success: false,
        message:
          `Could not reach the API server at ${target.hostname}.${extra} ` +
          "On Render open the API service → Connect → copy Internal URL and append `/api` as BACKEND_INTERNAL_API_URL on this web service.",
      },
      { status: 502, headers: BFF_JSON_HEADERS },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "set-cookie") return;
    /** `arrayBuffer()` is already decompressed; forwarding these confuses downstream caches. */
    if (lower === "content-encoding") return;
    if (lower === "content-length") return;
    out.append(key, value);
  });
  out.set("Cache-Control", BFF_NO_STORE);

  /** Buffer upstream body — streamed passthrough is brittle behind some CDNs (Cloudflare 502 HTML). */
  let bodyBuf: ArrayBuffer;
  try {
    bodyBuf = await upstream.arrayBuffer();
  } catch (e) {
    console.error("[api/backend] failed to read upstream body:", e);
    return NextResponse.json(
      {
        success: false,
        message:
          "The API responded but its body could not be read through the gateway. Retry or contact support.",
      },
      { status: 502, headers: BFF_JSON_HEADERS },
    );
  }

  return new NextResponse(bodyBuf, {
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
