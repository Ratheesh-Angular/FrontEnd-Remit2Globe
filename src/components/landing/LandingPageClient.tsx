"use client";

import { LandingCountryProvider } from "@/components/landing/LandingCountryContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHeroBlock } from "@/components/landing/LandingHeroBlock";
import { SolutionsSection } from "@/components/landing/SolutionsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CountriesSection } from "@/components/landing/CountriesSection";
import { MobileMoneyNetworksSection } from "@/components/landing/MobileMoneyNetworksSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export function LandingPageClient() {
  return (
    <LandingCountryProvider>
      <div className="min-h-screen flex flex-col bg-white">
        <LandingHeader />
        <main className="flex-1">
          <LandingHeroBlock />
          <SolutionsSection />
          <FeaturesSection />
          <CountriesSection />
          <MobileMoneyNetworksSection />
          <HowItWorksSection />
          <TestimonialsSection />
          <FaqSection />
          <CtaSection />
        </main>
        <LandingFooter />
      </div>
    </LandingCountryProvider>
  );
}
