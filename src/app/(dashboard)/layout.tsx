import { getValidatedServerSession } from "@/lib/auth-session";
import { loadDashboardShellUser } from "@/lib/load-dashboard-user.server";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const dynamic = "force-dynamic";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getValidatedServerSession();
  const initialUser = await loadDashboardShellUser(session?.user?.id);

  return (
    <DashboardLayoutClient
      initialSession={session}
      initialUser={initialUser}
    >
      {children}
    </DashboardLayoutClient>
  );
}
