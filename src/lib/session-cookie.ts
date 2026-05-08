/**
 * `Secure` cookies are ignored by browsers on plain HTTP. Use `secure` only when
 * the site is served over HTTPS, or when forcing via COOKIE_SECURE.
 */
export function sessionCookieSecure(): boolean {
  const explicit = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  const base = process.env.NEXTAUTH_URL?.trim() ?? "";
  return base.startsWith("https://");
}

export function sessionCookieBase(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
} {
  return {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: "lax",
    path: "/",
  };
}
