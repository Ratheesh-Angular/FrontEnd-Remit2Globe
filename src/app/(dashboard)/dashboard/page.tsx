import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, loadAppUser } from "@/lib/auth";
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

const CLEAR_SESSION_LOGIN =
  "/api/auth/clear-backend-session?callbackUrl=/login&nextAuth=1";

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
  const hasBackendToken = await hasBackendAuthCookie();

  if (hasBackendToken) {
    const me = await loadUserFromBackendMe();
    if (me) {
      return <DashboardClient user={me} />;
    }
  }

  const validated = await getValidatedServerSession();
  if (validated?.user) {
    return <DashboardClient user={validated.user} />;
  }

  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id?.trim();
  if (sessionUserId && !(await loadAppUser(sessionUserId))) {
    redirect(CLEAR_SESSION_LOGIN);
  }

  if (hasBackendToken) {
    redirect(CLEAR_SESSION_LOGIN);
  }

  redirect("/login");
}
