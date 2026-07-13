"use client";

import { HeroSection } from "@/components/landing/HeroSection";
import { RateCalculator } from "@/components/landing/RateCalculator";

export function LandingHeroBlock() {
  return (
    <section
      id="rate-calculator"
      className="relative overflow-hidden bg-gradient-to-b from-red-50/50 via-white to-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(13,148,136,0.12),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 lg:pt-12 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <HeroSection variant="compact" />
          <RateCalculator variant="compact" />
        </div>
      </div>
    </section>
  );
}
