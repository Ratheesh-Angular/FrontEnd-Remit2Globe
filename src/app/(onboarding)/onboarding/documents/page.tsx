import { redirect } from "next/navigation";

/** Legacy URL: document upload now lives on the profile KYC step. */
export default function OnboardingDocumentsRedirectPage() {
  redirect("/onboarding/profile?step=documents");
}
