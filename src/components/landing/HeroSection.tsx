"use client";

import { Globe, Shield, Zap } from "lucide-react";

const TRUST_POINTS = [
  { icon: Zap, label: "Fast Delivery" },
  { icon: Shield, label: "Secure Transfers" },
  { icon: Globe, label: "100+ Countries" },
];

type HeroSectionProps = {
  variant?: "default" | "compact";
};

export function HeroSection({ variant = "default" }: HeroSectionProps) {
  const isCompact = variant === "compact";

  const content = (
    <div
      className={
        isCompact
          ? "text-center lg:text-left max-w-xl lg:max-w-none mx-auto lg:mx-0"
          : "text-center max-w-3xl mx-auto"
      }
    >
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-medium mb-4 ${
          isCompact ? "text-xs" : "text-sm mb-6"
        }`}
      >
        <Globe className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        <span>Since 2013 · Licensed &amp; Regulated</span>
      </div>

      <h1
        className={
          isCompact
            ? "text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-slate-900 tracking-tight leading-tight"
            : "text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight"
        }
      >
        Global Payments <span className="text-red-600">Made Simple</span>
      </h1>

      <p
        className={`mt-4 text-slate-600 leading-relaxed ${
          isCompact
            ? "text-base lg:text-lg max-w-lg mx-auto lg:mx-0"
            : "mt-6 text-lg sm:text-xl max-w-2xl mx-auto"
        }`}
      >
        Send money to family, pay overseas suppliers, or transfer tuition fees
        securely from one powerful app. Fast, competitive, and trusted since
        2013.
      </p>

      {isCompact ? (
        <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3">
          {TRUST_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <div
                key={point.label}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                {point.label}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-2xl mx-auto">
          {TRUST_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <div
                key={point.label}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 text-red-600">
                  <Icon className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-900">
                  {point.label}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (isCompact) {
    return content;
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-red-50/50 via-white to-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(13,148,136,0.12),transparent)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 lg:pt-12 lg:pb-16">
        {content}
      </div>
    </section>
  );
}
