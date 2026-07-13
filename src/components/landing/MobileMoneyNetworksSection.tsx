"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StaticImageData } from "next/image";

import mtnLogo from "../../../assets/logos/mobile-money/MOMO MTN.png";
import airtelLogo from "../../../assets/logos/mobile-money/airtel money.png";
import mpesaLogo from "../../../assets/logos/mobile-money/MPESA.png";
import tigoLogo from "../../../assets/logos/mobile-money/tigo.png";
import orangeLogo from "../../../assets/logos/mobile-money/orange.png";

type MobileMoneyProvider = {
  name: string;
  description: string;
  logo: StaticImageData;
};

const PROVIDERS: MobileMoneyProvider[] = [
  {
    name: "MTN MoMo",
    description: "Uganda's largest mobile wallet — 12M+ active users.",
    logo: mtnLogo,
  },
  {
    name: "Airtel Money",
    description: "Nationwide Airtel coverage across Uganda.",
    logo: airtelLogo,
  },
  {
    name: "M-Pesa",
    description: "Safaricom M-Pesa across Kenya and East Africa.",
    logo: mpesaLogo,
  },
  {
    name: "Tigo",
    description: "Tigo mobile money across multiple African markets.",
    logo: tigoLogo,
  },
  {
    name: "Orange",
    description: "Orange Money across West and Central Africa.",
    logo: orangeLogo,
  },
];

export function MobileMoneyNetworksSection() {
  return (
    <section id="mobile-money" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 lg:mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-3">
            Mobile Money
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Supported Mobile Networks
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5">
          {PROVIDERS.map((provider) => (
            <article
              key={provider.name}
              className="flex flex-col items-center text-center rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 hover:border-red-200 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-center h-14 w-full mb-4">
                <Image
                  src={provider.logo}
                  alt={`${provider.name} logo`}
                  className="max-h-12 w-auto object-contain"
                />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-2">
                {provider.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-4 flex-1">
                {provider.description}
              </p>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Instant
              </span>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
          >
            Send Money
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
