import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DashboardLayoutClient from "./DashboardLayoutClient";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  return (
    <DashboardLayoutClient initialSession={session}>
      {children}
    </DashboardLayoutClient>
  );
}
