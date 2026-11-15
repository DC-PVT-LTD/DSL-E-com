'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle, MessageSquare } from 'lucide-react';
import { ContactSection } from '@/components/common/ContactSection';

const FAQS = [
  {
    q: 'How does islandwide distribution and delivery work in Sri Lanka?',
    a: 'We partner with premier logistics networks across all 25 districts in Sri Lanka. Orders are processed from our central Moratuwa warehouse within 24 hours and delivered in 2–3 business days. Islandwide delivery is completely FREE for retail orders above Rs. 5,000.',
  },
  {
    q: 'How does Find My Stationery work?',
    a: 'Bearista is our interactive guide designed to match your school grade (Grade 1–2 up to A/L) and tier (Essential, Standard, Premium) with official curriculum bundles, ensuring you get all required exercise books and tools in one step.',
  },
  {
    q: 'Can I customize the contents of a School Pack?',
    a: 'Yes! On every School Pack page, you can customize quantities, substitute compatible products (e.g. Atlas vs Promate exercise books), or add supplementary stationery supplies before proceeding to checkout.',
  },
  {
    q: 'How does the "Upload Booklist" feature work?',
    a: 'Simply snap a photo or upload a PDF of your school booklist. Our OCR and item matcher parses stationery names and quantities to match them with warehouse catalog stock for instant cart creation.',
  },
  {
    q: 'Are all distributed stationery brands 100% authentic?',
    a: 'Yes, absolutely. DSL Enterprises (Pvt) Ltd holds direct distribution rights and partnerships with authorized brands including Speed, Doms, Amigo, Linc, Pentonic, Accumate, Geommy, and FlexOffice.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept credit/debit cards (Visa, Mastercard via PayHere), Cash on Delivery (COD), and direct bank transfers for wholesale orders.',
  },
];

export default function FAQPage() {
  const [openSet, setOpenSet] = useState<Set<number>>(new Set([0, 1]));

  const toggleFaq = (idx: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <div className="w-full max-w-7xl xl:max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 py-8 sm:py-16 space-y-12 sm:space-y-16">
      {/* Top FAQ Section */}
      <div className="w-full space-y-6 sm:space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF4FF] text-[#0866E8] flex items-center justify-center mx-auto shadow-xs">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#09285C] tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Everything you need to know about purchasing stationery, school packs, and delivery across Sri Lanka.
          </p>
        </div>

        {/* 2-Column Responsive Full-Width Grid - No Empty Side Gutters */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          {FAQS.map((faq, idx) => {
            const isOpen = openSet.has(idx);
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-xs transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-start justify-between text-xs sm:text-sm font-bold text-[#09285C] hover:bg-[#F7FAFF] transition-colors cursor-pointer touch-target gap-3"
                >
                  <span className="flex-1">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#0866E8] shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-[#64748B] leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Decorative Section Divider */}
      <div className="relative w-full">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#F7FAFF] px-4 text-xs font-bold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1.5 rounded-full border border-slate-200 py-1">
            <MessageSquare className="w-3.5 h-3.5 text-[#0866E8]" /> Still Have Questions?
          </span>
        </div>
      </div>

      {/* Integrated Contact Section */}
      <div className="bg-[#F7FAFF] rounded-3xl border border-slate-200/70 p-6 sm:p-10 lg:p-12 shadow-xs">
        <ContactSection
          title="Still Have Questions? Contact Our Team"
          subtitle="Can't find what you're looking for above? Reach out directly to our customer care and distribution desk via phone, WhatsApp, or send us a message below."
          showBadge={false}
        />
      </div>
    </div>
  );
}
