import { getValidatedServerSession } from "@/lib/auth-session";
import OnboardingLayoutClient from "./OnboardingLayoutClient";

export default async function OnboardingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getValidatedServerSession();
  return (
    <OnboardingLayoutClient initialSession={session}>
      {children}
    </OnboardingLayoutClient>
  );
}
