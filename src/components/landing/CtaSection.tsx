"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-br from-red-600 to-red-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
          Ready to Send Money Home?
        </h2>
        <p className="mt-6 text-lg sm:text-xl text-red-100 max-w-2xl mx-auto">
          Join thousands of customers who trust Flex Money for fast, secure, and
          affordable international transfers.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 h-14 px-8 text-base font-semibold text-red-700 bg-white rounded-xl hover:bg-red-50 transition-colors shadow-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 h-14 px-8 text-base font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
