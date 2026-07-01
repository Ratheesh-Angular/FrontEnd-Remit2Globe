import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";import { authOptions, loadAppUser } from "@/lib/auth";
import { getValidatedServerSession } from "@/lib/auth-session";
import {
  hasBackendAuthCookie,
  loadDashboardShellUser,
} from "@/lib/load-dashboard-user.server";
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
  const shell = await loadDashboardShellUser(undefined);
  if (!shell) return null;
  return {
    id: shell.id,
    email: shell.email,
    name: shell.name,
    image: null,
    role: shell.role,
    kycStatus: shell.kycStatus,
    createdAt: shell.createdAt,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const hasBackendToken = await hasBackendAuthCookie();

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
