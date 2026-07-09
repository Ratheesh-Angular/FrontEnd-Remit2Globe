"use client";

import Link from "next/link";
import { ArrowRight, Globe, Shield, Zap } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-red-50/50 via-white to-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(13,148,136,0.12),transparent)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 lg:pt-12 lg:pb-16  ">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-sm font-medium mb-6">
            <Globe className="w-4 h-4" />
            <span>Trusted by thousands worldwide</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight">
            Send Money Abroad{" "}
            <span className="text-red-600">with Confidence</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Fast, secure transfers to 100+ countries. Bank accounts, mobile
            money, or cash pickup - your money arrives safely, every time.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 text-base font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/25 hover:shadow-red-600/30"
            >
              Start Sending
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#rate-calculator"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 text-base font-semibold text-red-700 bg-white border-2 border-red-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 transition-all"
            >
              Check Live Rates
            </a>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 text-red-600">
                <Zap className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-900">
                Fast Delivery
              </p>
              <p className="text-xs text-slate-500">Money arrives in minutes</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 text-red-600">
                <Shield className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-900">
                Secure Transfers
              </p>
              <p className="text-xs text-slate-500">Bank-grade encryption</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 text-red-600">
                <Globe className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-900">
                100+ Countries
              </p>
              <p className="text-xs text-slate-500">Global coverage</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
