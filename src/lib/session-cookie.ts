/**
 * `Secure` cookies are ignored by browsers on plain HTTP. Prefer the **actual**
 * request URL / proxy headers over `NEXTAUTH_URL` so a mistaken `https://`
 * canonical URL does not break `http://` IP access (e.g. raw EC2).
 */
export function sessionCookieSecure(req?: Request): boolean {
  const explicit = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  if (req) {
    const xf = req.headers.get("x-forwarded-proto");
    if (xf) {
      const first = xf.split(",")[0]?.trim().toLowerCase();
      if (first === "https") return true;
      if (first === "http") return false;
    }
    try {
      const u = new URL(req.url);
      if (u.protocol === "https:") return true;
      if (u.protocol === "http:") return false;
    } catch {
      /* ignore */
    }
  }

  const base = process.env.NEXTAUTH_URL?.trim() ?? "";
  return base.startsWith("https://");
}

export function sessionCookieBase(req?: Request): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
} {
  return {
    httpOnly: true,
    secure: sessionCookieSecure(req),
    sameSite: "lax",
    path: "/",
  };
}
