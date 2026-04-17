import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OnboardingLayoutClient from "./OnboardingLayoutClient";

export default async function OnboardingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  return (
    <OnboardingLayoutClient initialSession={session}>
      {children}
    </OnboardingLayoutClient>
  );
}
