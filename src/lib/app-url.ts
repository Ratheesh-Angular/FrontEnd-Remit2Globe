import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

function envSiteOrigin(): string | null {
  for (const raw of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      const u = new URL(
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`,
      );
      if (process.env.NODE_ENV === "production" && isLocalHost(u.hostname)) {
        continue;
      }
      return u.origin;
    } catch {
      continue;
    }
  }
  return null;
}

function protoFromRequest(req: NextRequest | Request): string {
  const xf = req.headers.get("x-forwarded-proto");
  if (xf) {
    const first = xf.split(",")[0]?.trim().toLowerCase();
    if (first === "https" || first === "http") return first;
  }
  try {
    return new URL(req.url).protocol.replace(":", "") || "https";
  } catch {
    return process.env.NODE_ENV === "production" ? "https" : "http";
  }
}

function hostFromHeaders(req: NextRequest | Request): string | null {
  const xfHost = req.headers.get("x-forwarded-host");
  if (xfHost) {
    const first = xfHost.split(",")[0]?.trim();
    if (first) return first;
  }
  const host = req.headers.get("host")?.trim();
  if (host) return host;
  return null;
}

/**
 * Public browser origin behind nginx (not the internal localhost:3000 upstream URL).
 */
export function getPublicAppOrigin(req: NextRequest | Request): string {
  const host = hostFromHeaders(req);
  if (host) {
    const hostname = host.split(":")[0] ?? host;
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd || !isLocalHost(hostname)) {
      const proto = protoFromRequest(req);
      return `${proto}://${host}`;
    }
  }

  const fromEnv = envSiteOrigin();
  if (fromEnv) return fromEnv;

  try {
    const u = new URL(req.url);
    if (process.env.NODE_ENV !== "production" || !isLocalHost(u.hostname)) {
      return u.origin;
    }
  } catch {
    /* ignore */
  }

  return envSiteOrigin() ?? "http://localhost:3000";
}

export function redirectToAppPath(
  req: NextRequest | Request,
  path: string,
): NextResponse {
  const safePath =
    path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return NextResponse.redirect(new URL(safePath, getPublicAppOrigin(req)));
}
