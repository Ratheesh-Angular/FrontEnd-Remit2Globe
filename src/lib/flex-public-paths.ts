/** Allowlisted flex subpaths fetchable from the browser without auth (GET only). */
export function isPublicFlexBrowserPath(path: string): boolean {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/countries") return true;
  return /^\/banks\/[A-Za-z0-9_-]{2,12}$/.test(p);
}
