"use client";

import Link from "next/link";
import Flag from "react-world-flags";
import { Building2, GraduationCap, User } from "lucide-react";

type SolutionCard = {
  id: string;
  icon: typeof User;
  title: string;
  description: string;
  features: string[];
  chips: { label: string; iso2?: string }[];
  href: string;
  cta: string;
};

const SOLUTIONS: SolutionCard[] = [
  {
    id: "personal",
    icon: User,
    title: "Personal Payments",
    description: "Send money to your loved ones quickly and securely.",
    features: [
      "Bank Transfers",
      "Mobile Money",
      "Family Support",
      "Friends & Relatives",
      "Emergency Transfers",
    ],
    chips: [
      { label: "Kenya", iso2: "KE" },
      { label: "Uganda", iso2: "UG" },
      { label: "Tanzania", iso2: "TZ" },
      { label: "Ghana", iso2: "GH" },
      { label: "India", iso2: "IN" },
      { label: "Philippines", iso2: "PH" },
    ],
    href: "/register",
    cta: "Send Money",
  },
  {
    id: "business",
    icon: Building2,
    title: "Business Payments",
    description:
      "Pay suppliers and business partners around the world with confidence.",
    features: [
      "Supplier Payments",
      "Invoice Payments",
      "Import & Export Payments",
      "International Trade",
      "Competitive FX Rates",
    ],
    chips: [
      { label: "China", iso2: "CN" },
      { label: "UAE", iso2: "AE" },
      { label: "India", iso2: "IN" },
      { label: "UK", iso2: "GB" },
      { label: "Singapore", iso2: "SG" },
    ],
    href: "/register?accountType=corporate",
    cta: "Business Payments",
  },
  {
    id: "education",
    icon: GraduationCap,
    title: "Education Payments",
    description:
      "Pay tuition fees and living expenses directly to institutions and students abroad.",
    features: ["Tuition Fees", "Accommodation", "Student Living Expenses"],
    chips: [
      { label: "UK", iso2: "GB" },
      { label: "USA", iso2: "US" },
      { label: "Canada", iso2: "CA" },
      { label: "Australia", iso2: "AU" },
      { label: "Europe", iso2: "EU" },
      { label: "Malaysia", iso2: "MY" },
      { label: "Singapore", iso2: "SG" },
    ],
    href: "/register",
    cta: "Pay Tuition",
  },
];

export function SolutionsSection() {
  return (
    <section id="solutions" className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16 max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-3">
            One App
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Multiple payment needs, one app.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {SOLUTIONS.map((solution) => {
            const Icon = solution.icon;
            return (
              <article
                key={solution.id}
                id={solution.id}
                className="flex flex-col bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 hover:shadow-lg hover:shadow-slate-200/50 hover:border-red-200 transition-all"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-red-50 text-red-600 mb-5">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {solution.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  {solution.description}
                </p>
                <ul className="space-y-2 mb-5 text-sm text-slate-600">
                  {solution.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 mb-6">
                  {solution.chips.map((chip) => (
                    <span
                      key={chip.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                    >
                      {chip.iso2 ? (
                        <Flag
                          code={chip.iso2}
                          className="w-4 h-3 rounded-sm object-cover"
                        />
                      ) : null}
                      {chip.label}
                    </span>
                  ))}
                  <span className="text-xs font-medium text-slate-500">
                    and many more…
                  </span>
                </div>
                <Link
                  href={solution.href}
                  className="mt-auto inline-flex items-center justify-center h-11 px-5 text-sm font-semibold text-red-700 border border-red-600 rounded-xl hover:bg-red-50 transition-colors"
                >
                  {solution.cta}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
