import React from 'react';
import { RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ReturnsPage() {
  return (
    <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-8 sm:py-16">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div className="space-y-2 text-center max-w-xl mx-auto">
          <span className="text-xs font-black uppercase tracking-wider text-[#0866E8] bg-[#EAF4FF] px-3.5 py-1 rounded-full border border-[#0866E8]/20">
            Customer Guarantee
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-[#09285C] tracking-tight">
            Returns &amp; Replacement Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Our commitment to quality assurance across all exercise books, writing instruments, and school packs.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs text-xs sm:text-sm text-[#09285C]/80 leading-relaxed">
          <div className="space-y-2.5">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">7-Day Replacement Guarantee</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              If you receive damaged products, incorrect rulings (e.g. ordered single line but received square rule),
              or factory defects, you can request an instant replacement or full refund within 7 days of delivery.
            </p>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">Return Eligibility Criteria</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#64748B]">
              <li>Items must be in original packaging (unopened pen sets, sealed exercise book bundles).</li>
              <li>Proof of purchase (DSL Order ID) must be provided.</li>
              <li>Curated and customized school packs can be returned in full or item-by-item if defective.</li>
            </ul>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-slate-100">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">Refund Processing</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Refunds for card payments are credited back within 3–5 business days. For cash on delivery orders,
              refunds are processed via direct bank transfer to your Sri Lankan commercial bank account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
