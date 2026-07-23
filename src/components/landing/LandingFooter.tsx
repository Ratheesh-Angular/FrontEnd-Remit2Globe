"use client";

import Image from "next/image";
import Link from "next/link";
import flexLogo from "../../../assets/logos/flex-logo.png";
import { FooterVersionBadge } from "@/components/landing/FooterVersionBadge";

const FOOTER_LINKS = {
  legal: [
    {
      label: "Privacy Policy",
      href: "https://www.flex-money.com/privacypolicy/",
      external: true,
    },
    {
      label: "Terms of Service",
      href: "https://www.flex-money.com/terms/",
      external: true,
    },
  ],
  support: [{ label: "FAQ", href: "#faq", external: false }],
};

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <h1 className="text-2xl font-bold text-white">Flex Money</h1>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Fast, secure, and affordable international money transfers. Send
              money to your loved ones in 100+ countries with confidence.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.legal.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Support
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.support.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start gap-1">
              <p className="text-sm text-slate-500">
                &copy; {currentYear} Flex Money. All rights reserved.
              </p>
              <FooterVersionBadge />
            </div>
            <p className="text-sm text-slate-500">
              Licensed and regulated money transfer service.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
