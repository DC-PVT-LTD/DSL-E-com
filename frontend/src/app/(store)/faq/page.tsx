'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';

const FAQS = [
  {
    q: 'How does islandwide delivery work in Sri Lanka?',
    a: 'We partner with leading courier services across all 25 districts in Sri Lanka. Orders are processed within 24 hours and delivered within 2-3 business days. Delivery is completely FREE for orders above Rs. 5,000.',
  },
  {
    q: 'Can I customize the contents of a School Pack?',
    a: 'Yes! On the School Pack detail page, you can adjust quantities, swap out items for compatible alternatives (e.g. Atlas vs Promate exercise books), or add extra stationery before adding the bundle to your cart.',
  },
  {
    q: 'How does the "Upload Your List" feature work?',
    a: 'You can take a photo of your school booklist or upload a PDF. Our smart matcher automatically extracts the item names and quantities and suggests matching products from our catalog so you can checkout without searching item by item.',
  },
  {
    q: 'Are all the stationery brands authentic?',
    a: '100% yes. We do not sell counterfeit or imitation goods. All products are authentic stock from authorized manufacturers including Atlas, Promate, Nataraj, Faber-Castell, and Staedtler.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We support Visa, Mastercard, Cash on Delivery (COD), and direct bank transfers. (Note: in this frontend demo, payments are simulated without real charges).',
  },
];

export default function FAQPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-[#FFFDF0] border-2 border-[#0066CC] text-[#0066CC] flex items-center justify-center mx-auto shadow-xs">
          <HelpCircle className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#292525] tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-xs text-[#292525]/70">
          Everything you need to know about buying stationery, school packs, and delivery in Sri Lanka.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-[#C6E7FF]/60 overflow-hidden shadow-2xs transition-all"
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-[#292525]"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-[#0066CC] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-xs text-[#292525]/70 leading-relaxed border-t border-[#C6E7FF]/20 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
