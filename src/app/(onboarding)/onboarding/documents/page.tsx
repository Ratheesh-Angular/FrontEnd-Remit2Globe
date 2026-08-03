import { redirect } from "next/navigation";

/** Legacy URL: individual KYC now starts Signzy from the profile personal-info step. */
export default function OnboardingDocumentsRedirectPage() {
  redirect("/onboarding/profile");
}
