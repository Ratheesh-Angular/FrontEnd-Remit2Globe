import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, loadAppUser } from "@/lib/auth";
import { getValidatedServerSession } from "@/lib/auth-session";
import { resolveBackendFetchBase } from "@/lib/backend-api-base";
import { backendOutboundFetch } from "@/lib/backend-outbound-fetch";
import DashboardClient from "./DashboardClient";

type DashboardUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
  kycStatus?: string;
  createdAt?: string;
};

async function loadUserFromBackendMe(): Promise<DashboardUser | null> {
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  if (!cookieHeader.includes("token=")) return null;

  const resolved = resolveBackendFetchBase();
  if (!resolved.ok) return null;

  const base = resolved.baseUrl;
  const res = await backendOutboundFetch(`${base}/auth/me`, {
    headers: { cookie: cookieHeader },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    data?: {
      user?: {
        id: string;
        email: string | null;
        name?: string | null;
        phone: string | null;
        role: string;
        kycStatus: string;
        createdAt: string;
      };
    };
  };
  const u = body.data?.user;
  if (!u?.id) return null;

  const displayName =
    typeof u.name === "string" && u.name.trim() ? u.name.trim() : null;

  return {
    id: u.id,
    email: u.email,
    name: displayName,
    image: null,
    role: u.role,
    kycStatus: u.kycStatus,
    createdAt:
      typeof u.createdAt === "string"
        ? u.createdAt
        : new Date(u.createdAt as unknown as Date).toISOString(),
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const hasBackendToken = Boolean(cookieStore.get("token")?.value);

  const sessionUserId = session?.user?.id?.trim();
  if (sessionUserId) {
    const row = await loadAppUser(sessionUserId);
    if (!row) {
      redirect("/api/auth/signout?callbackUrl=/register");
    }
    const validated = await getValidatedServerSession();
    if (validated?.user) {
      return <DashboardClient user={validated.user} />;
    }
  }

  if (hasBackendToken) {
    const me = await loadUserFromBackendMe();
    if (me) {
      return <DashboardClient user={me} />;
    }
    redirect("/api/auth/clear-backend-session?callbackUrl=/register");
  }

  redirect("/register");
}
