"use client";

import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    location: "USA → India",
    avatar: "PS",
    rating: 5,
    quote:
      "I've been sending money to my parents in India for years. Flex Money has the best rates I've found, and transfers arrive within minutes. Highly recommended!",
  },
  {
    name: "James Okonkwo",
    location: "UK → Nigeria",
    avatar: "JO",
    rating: 5,
    quote:
      "The app is so easy to use. I set up my family as recipients once, and now I can send money home with just a few taps. Great service!",
  },
  {
    name: "Sarah Ahmed",
    location: "UAE → Pakistan",
    avatar: "SA",
    rating: 5,
    quote:
      "Finally a service that works reliably to Pakistan. The exchange rates are competitive, and customer support is always helpful when I have questions.",
  },
  {
    name: "Daniel Mensah",
    location: "Canada → Ghana",
    avatar: "DM",
    rating: 5,
    quote:
      "My mother can pick up cash directly at a local agent. No bank account needed. This has made supporting my family so much easier.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Trusted by Thousands
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            People around the world trust Flex Money to send money to their
            loved ones.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 hover:shadow-lg hover:shadow-slate-200/50 transition-all"
            >
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <blockquote className="text-slate-700 leading-relaxed mb-6">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-700 font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
