"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { FlexLogo } from "@/components/brand/FlexLogo";
import { LandingCountrySelect } from "@/components/landing/LandingCountrySelect";

const ROUTE_NAV_LINKS = [
  {
    id: "personal",
    label: "Personal",
    href: "/register?accountType=individual",
  },
  {
    id: "business",
    label: "Business",
    href: "/register?accountType=corporate",
  },
];

const ANCHOR_NAV_LINKS = [
  { id: "how-it-works", label: "How It Works", href: "#how-it-works" },
  { id: "countries", label: "Countries", href: "#countries" },
  { id: "faq", label: "FAQ", href: "#faq" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200"
          : "bg-white"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <FlexLogo className="h-8 sm:h-9 lg:h-10 max-w-none" priority />
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {ROUTE_NAV_LINKS.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-red-700 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {ANCHOR_NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-red-700 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <LandingCountrySelect />
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-10 px-5 text-sm font-medium text-red-700 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center h-10 px-5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white">
          <nav className="px-4 py-4 space-y-2">
            <div className="pb-3 mb-1 border-b border-slate-100">
              <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Your country
              </p>
              <LandingCountrySelect
                className="px-3"
                fullWidth
                onSelect={() => setMobileOpen(false)}
              />
            </div>
            {ROUTE_NAV_LINKS.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                {link.label}
              </Link>
            ))}
            {ANCHOR_NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-slate-200 mt-3 space-y-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center px-4 py-2.5 text-sm font-medium text-red-700 border border-red-600 rounded-lg hover:bg-red-50"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
