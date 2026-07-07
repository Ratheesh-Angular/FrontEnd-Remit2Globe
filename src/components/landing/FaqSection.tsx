"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "How long do transfers take?",
    answer:
      "Most transfers arrive within minutes to bank accounts and mobile wallets. Cash pickup is usually available within hours. Delivery times may vary based on the destination country, payout method, and banking hours.",
  },
  {
    question: "What are the fees?",
    answer:
      "Our fees are transparent and shown upfront before you confirm any transfer. Fees vary based on the destination country, payout method, and transfer amount. We also offer competitive exchange rates with no hidden markups.",
  },
  {
    question: "Which countries can I send to?",
    answer:
      "Amigo supports transfers to 97+ countries across Africa, Asia, Europe, and the Americas. Popular destinations include India, Kenya, Ghana, Nigeria, Uganda, Pakistan, Bangladesh, Philippines, and many more.",
  },
  {
    question: "Is my money safe?",
    answer:
      "Absolutely. We use bank-grade encryption to protect all transactions. We're licensed and regulated, and your money is held in secure, segregated accounts until it reaches your recipient.",
  },
  {
    question: "How do I track my transfer?",
    answer:
      "Once you initiate a transfer, you can track its status in real-time through your dashboard. You'll also receive email notifications at each step — when payment is received, when funds are being processed, and when delivery is complete.",
  },
  {
    question: "What payout options are available?",
    answer:
      "We offer multiple payout options including direct bank transfers, mobile money wallets (like M-Pesa, GCash, etc.), and cash pickup at partner locations. Available options vary by country.",
  },
  {
    question: "Do I need to verify my identity?",
    answer:
      "Yes, we require a one-time KYC (Know Your Customer) verification to comply with international regulations. This usually takes just a few minutes and you only need to do it once. After verification, you can send unlimited transfers.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-16 lg:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Got questions? We&apos;ve got answers.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={item.question}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex items-center justify-between w-full px-5 py-4 text-left bg-white hover:bg-slate-50 transition-colors"
                >
                  <span className="font-medium text-slate-900">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-500 shrink-0 ml-4 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-slate-600 leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
