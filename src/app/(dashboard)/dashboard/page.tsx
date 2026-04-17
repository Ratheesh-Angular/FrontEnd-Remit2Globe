import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
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

  const base = (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"
  ).replace(/\/$/, "");
  const res = await fetch(`${base}/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    data?: {
      user?: {
        id: string;
        email: string | null;
        phone: string | null;
        role: string;
        kycStatus: string;
        createdAt: string;
      };
    };
  };
  const u = body.data?.user;
  if (!u?.id) return null;

  return {
    id: u.id,
    email: u.email,
    name: null,
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

  if (session?.user) {
    return <DashboardClient user={session.user} />;
  }

  if (hasBackendToken) {
    const me = await loadUserFromBackendMe();
    if (me) {
      return <DashboardClient user={me} />;
    }
  }

  redirect("/register");
}
