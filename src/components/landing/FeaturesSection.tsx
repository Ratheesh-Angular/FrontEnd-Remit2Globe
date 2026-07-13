"use client";

import {
  Banknote,
  Clock,
  Globe,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Clock,
    title: "Fast Delivery",
    description:
      "Money arrives quickly often within minutes to bank accounts your recipients already use.",
  },
  {
    icon: Banknote,
    title: "Best Rates",
    description:
      "Competitive exchange rates with transparent fees. No hidden charges what you see is what you pay.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Transfers",
    description:
      "Bank-grade encryption protects every transaction. Licensed and regulated for your peace of mind.",
  },
  {
    icon: Globe,
    title: "Multiple Payout Options",
    description:
      "Send to bank accounts, mobile money. Flexible delivery for any recipient.",
  },
  {
    icon: Smartphone,
    title: "Easy Tracking",
    description:
      "Real-time notifications and transfer status updates. Know exactly where your money is at all times.",
  },
  {
    icon: UserCheck,
    title: "Verify Once",
    description:
      "Complete KYC once and send unlimited times. Save recipients and transfer in just a few clicks.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Why Choose Flex Money
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Everything you need for fast, secure global transfers built for
            people who send money home.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 hover:shadow-lg hover:shadow-slate-200/50 hover:border-red-200 transition-all"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-red-50 text-red-600 mb-5 group-hover:bg-red-100 transition-colors">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
