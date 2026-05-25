import { getValidatedServerSession } from "@/lib/auth-session";
import DashboardLayoutClient from "./DashboardLayoutClient";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getValidatedServerSession();
  return (
    <DashboardLayoutClient initialSession={session}>
      {children}
    </DashboardLayoutClient>
  );
}
