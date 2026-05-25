import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  backendFetchResolutionMessage,
  BACKEND_FETCH_TIMEOUT_MS,
  resolveBackendFetchBase,
} from "@/lib/backend-api-base";
import { backendOutboundFetch } from "@/lib/backend-outbound-fetch";
import { isPublicFlexBrowserPath } from "@/lib/flex-public-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BFF_NO_STORE = "private, no-store, max-age=0" as const;
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

type RouteCtx = { params: Promise<{ path?: string[] }> };

/** Detect ECONNREFUSED nested on fetch AggregateError.cause (Node). */
function upstreamLikelyUnreachable(err: unknown): boolean {
  const e = err as Error & { cause?: unknown };
  const c = e?.cause as { code?: string; errors?: Array<{ code?: string }> } | undefined;
  if (c?.code === "ECONNREFUSED") return true;
  if (Array.isArray(c?.errors) && c.errors.some((x) => x?.code === "ECONNREFUSED")) {
    return true;
  }
  return false;
}

function segmentToRelativePath(segments: string[]): string {
  if (segments.length === 0) return "";
  return `/${segments.join("/")}`;
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path: segments = [] } = await ctx.params;
  const rel = segmentToRelativePath(segments);
  if (!rel || !isPublicFlexBrowserPath(rel)) {
    return NextResponse.json(
      { success: false, message: "Not found" },
      { status: 404, headers: BFF_JSON_HEADERS },
    );
  }

  const resolved = resolveBackendFetchBase();
  if (!resolved.ok) {
    console.error("[api/public-flex] misconfigured:", resolved.reason);
    return NextResponse.json(
      { success: false, message: backendFetchResolutionMessage(resolved) },
      { status: 503, headers: BFF_JSON_HEADERS },
    );
  }

  const base = resolved.baseUrl.replace(/\/+$/, "");
  let target: URL;
  try {
    target = new URL(`${base}/flex${rel}`);
  } catch (e) {
    console.error("[api/public-flex] invalid target URL:", base, rel, e);
    return NextResponse.json(
      { success: false, message: "Invalid upstream flex URL." },
      { status: 503, headers: BFF_JSON_HEADERS },
    );
  }

  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const forwardHeaders = new Headers();
  const accept = req.headers.get("accept");
  if (accept) forwardHeaders.set("Accept", accept);

  let upstream: Response;
  try {
    upstream = await backendOutboundFetch(target.toString(), {
      method: "GET",
      headers: forwardHeaders,
      signal: AbortSignal.timeout(BACKEND_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const hint =
      err instanceof Error ? err.message : typeof err === "string" ? err : "unknown_error";
    console.error("[api/public-flex] upstream fetch failed:", target.toString(), hint, err);

    const devUnreachable =
      process.env.NODE_ENV !== "production" &&
      ((typeof hint === "string" &&
        (hint.toLowerCase().includes("econnrefused") ||
          hint.toLowerCase().includes("fetch failed"))) ||
        upstreamLikelyUnreachable(err));

    const message = devUnreachable
      ? "Could not reach the Flex API upstream. Start the Express API (cbp-backend, default port 8000) or set BACKEND_INTERNAL_API_URL / BACKEND_API_URL / NEXT_PUBLIC_API_URL to a reachable /api root."
      : "Could not reach the Flex API upstream.";

    return NextResponse.json(
      { success: false, message },
      { status: 502, headers: BFF_JSON_HEADERS },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "set-cookie") return;
    if (lower === "content-encoding") return;
    if (lower === "content-length") return;
    out.append(key, value);
  });
  out.set("Cache-Control", BFF_NO_STORE);

  let bodyBuf: ArrayBuffer;
  try {
    bodyBuf = await upstream.arrayBuffer();
  } catch (e) {
    console.error("[api/public-flex] failed to read upstream body:", e);
    return NextResponse.json(
      {
        success: false,
        message: "Upstream responded but the body could not be read.",
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
