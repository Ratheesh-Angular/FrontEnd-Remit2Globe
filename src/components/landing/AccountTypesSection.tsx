"use client";

import Link from "next/link";
import { ArrowRight, Building2, User } from "lucide-react";

const ACCOUNT_TYPES = [
  {
    id: "personal",
    anchorId: "account-types-personal",
    icon: User,
    title: "Personal account",
    description:
      "Send money to family, friends, and personal recipients. Ideal for remittances, travel support, and everyday transfers.",
    href: "/register",
    cta: "Create personal account",
  },
  {
    id: "business",
    anchorId: "account-types-business",
    icon: Building2,
    title: "Business account",
    description:
      "Pay suppliers, settle invoices, and manage international trade payments with tools built for corporate senders.",
    href: "/register?accountType=corporate",
    cta: "Create business account",
  },
];

export function AccountTypesSection() {
  return (
    <section id="account-types" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16 max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-3">
            Choose your account
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Personal or business — we have you covered
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Open the right account for how you send money. Switch paths anytime
            during registration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {ACCOUNT_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <article
                key={type.id}
                id={type.anchorId}
                className="group flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-8 hover:border-red-300 hover:shadow-lg hover:shadow-red-100/40 transition-all scroll-mt-24"
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 text-red-600 mb-6 group-hover:bg-red-100 transition-colors">
                  <Icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  {type.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-8 flex-1">
                  {type.description}
                </p>
                <Link
                  href={type.href}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                >
                  {type.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
