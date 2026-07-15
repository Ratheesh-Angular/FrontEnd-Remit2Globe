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
import moovLogo from "../../../assets/logos/mobile-money/moov-money.png";
import waveLogo from "../../../assets/logos/mobile-money/wave.png";
import gcashLogo from "../../../assets/logos/mobile-money/gcash.png";
import mayaLogo from "../../../assets/logos/mobile-money/maya.png";
import bkashLogo from "../../../assets/logos/mobile-money/bkash.png";
import nagadLogo from "../../../assets/logos/mobile-money/nagad.png";
import esevaLogo from "../../../assets/logos/mobile-money/eseva.png";
import touchAndGoLogo from "../../../assets/logos/mobile-money/touch-and-go.png";

type MobileMoneyProvider = {
  name: string;
  description: string;
  logo: StaticImageData;
};

const PROVIDERS: MobileMoneyProvider[] = [
  {
    name: "MTN MoMo",
    description:
      "Africa’s largest mobile money network, serving millions of customers across Uganda, Ghana, Rwanda, Cameroon, Côte d’Ivoire, Zambia, Benin, and other MTN markets.",
    logo: mtnLogo,
  },
  {
    name: "Airtel Money",
    description:
      "Fast and secure transfers to Airtel Money wallets across Kenya, Uganda, Tanzania, Rwanda, Zambia, Malawi, and other Airtel markets in Africa.",
    logo: airtelLogo,
  },
  {
    name: "M-PESA",
    description:
      "The leading mobile money service in Kenya, Tanzania, Mozambique, Lesotho, the Democratic Republic of Congo, Ghana, and other supported markets.",
    logo: mpesaLogo,
  },
  {
    name: "Tigo Pesa (Mixx by Yas)",
    description:
      "Reliable wallet transfers across Tanzania and other supported East African mobile money networks.",
    logo: tigoLogo,
  },
  {
    name: "Orange Money",
    description:
      "Send money instantly to Orange Money wallets across West and Central Africa, including Senegal, Mali, Côte d’Ivoire, Cameroon, Guinea, Madagascar, and more.",
    logo: orangeLogo,
  },
  {
    name: "Moov Money",
    description:
      "Secure transfers to Moov Money customers across Benin, Togo, Burkina Faso, Gabon, and other supported markets.",
    logo: moovLogo,
  },
  {
    name: "Wave",
    description:
      "Low-cost wallet transfers to Wave users in Senegal, Côte d’Ivoire, and other growing African markets.",
    logo: waveLogo,
  },
  {
    name: "GCash",
    description:
      "The Philippines’ leading digital wallet for instant person-to-person and merchant payments.",
    logo: gcashLogo,
  },
  {
    name: "PayMaya",
    description:
      "Secure digital wallet and banking app serving millions of users across the Philippines.",
    logo: mayaLogo,
  },
  {
    name: "bKash",
    description:
      "Bangladesh’s leading mobile financial service with nationwide wallet coverage for fast and secure transfers.",
    logo: bkashLogo,
  },
  {
    name: "Nagad",
    description:
      "Instant wallet transfers to millions of Nagad users across Bangladesh.",
    logo: nagadLogo,
  },
  {
    name: "eSewa",
    description:
      "Nepal’s most popular digital wallet for instant payments and money transfers.",
    logo: esevaLogo,
  },
  {
    name: "Touch ’n Go eWallet",
    description:
      "Malaysia’s leading digital wallet for payments, transfers, and everyday transactions.",
    logo: touchAndGoLogo,
  },
];

export function MobileMoneyNetworksSection() {
  return (
    <section id="mobile-money" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 lg:mb-12 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-3">
            Mobile Money
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
            Send Money to Africa & Asia’s Leading Mobile Wallets
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Transfer funds instantly to the most trusted mobile money and
            digital wallet providers across Africa and Asia, all through one
            simple payment platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
          {PROVIDERS.map((provider) => (
            <article
              key={provider.name}
              className="flex flex-col items-center text-center rounded-2xl border border-slate-200 bg-white p-5 lg:p-6 hover:border-red-200 hover:shadow-md transition-all h-full"
            >
              <div className="flex items-center justify-center h-28 sm:h-32 w-full mb-5 rounded-xl bg-slate-50 px-4">
                <Image
                  src={provider.logo}
                  alt={`${provider.name} logo`}
                  className="max-h-24 sm:max-h-28 w-auto max-w-full object-contain"
                />
              </div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900 mb-2">
                {provider.name}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1 min-h-[4.5rem]">
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
