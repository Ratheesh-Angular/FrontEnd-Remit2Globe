import { redirect } from "next/navigation";

/** Legacy URL: KYC outcome is shown on the Signzy result page or profile. */
export default function OnboardingStatusRedirectPage() {
  redirect("/onboarding/kyc/result");
}
