"use client";

import { CheckCircle2, Send, UserPlus, Wallet } from "lucide-react";

const STEPS = [
  {
    icon: UserPlus,
    step: 1,
    title: "Create Account",
    description:
      "Sign up in minutes with your email or Google account. Quick registration to get started.",
  },
  {
    icon: CheckCircle2,
    step: 2,
    title: "Verify Identity",
    description:
      "Complete a quick KYC verification for compliance. Usually takes just a few minutes.",
  },
  {
    icon: Wallet,
    step: 3,
    title: "Add Recipient",
    description:
      "Save your recipient's details once — bank account, mobile money.",
  },
  {
    icon: Send,
    step: 4,
    title: "Send Money",
    description:
      "Choose your amount, confirm the rate, pay securely, and track delivery in real-time.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-8 lg:py-16 bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Sending money home is simple. Complete your first transfer in just
            four easy steps.
          </p>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-20 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-red-200 via-red-300 to-red-200" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 mb-5">
                    <Icon className="w-7 h-7" />
                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-white text-red-600 text-xs font-bold border-2 border-red-600">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed max-w-xs">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
