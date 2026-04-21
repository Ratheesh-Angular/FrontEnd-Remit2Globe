import { redirect } from "next/navigation";

/** Legacy URL: submission confirmation is the final step on the profile KYC flow. */
export default function OnboardingStatusRedirectPage() {
  redirect("/onboarding/profile?step=submitted");
}
