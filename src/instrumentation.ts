/**
 * Prefer IPv4 ordering for server-side DNS resolution (improves Render → outbound HTTPS reachability).
 * Dynamic import keeps `node:dns` out of the Edge bundle analysis path.
 */
export async function register() {
  try {
    const dns = await import("node:dns");
    if (typeof dns.setDefaultResultOrder === "function") {
      dns.setDefaultResultOrder("ipv4first");
    }
  } catch {
    /* non-Node context */
  }
}
