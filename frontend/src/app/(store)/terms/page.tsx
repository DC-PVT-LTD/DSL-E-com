import React from 'react';

export default function TermsPage() {
  return (
    <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-8 sm:py-16">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div className="space-y-2 text-center max-w-xl mx-auto">
          <span className="text-xs font-black uppercase tracking-wider text-[#0866E8] bg-[#EAF4FF] px-3.5 py-1 rounded-full border border-[#0866E8]/20">
            Legal &amp; Policy
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-[#09285C] tracking-tight">Terms of Service</h1>
          <p className="text-xs sm:text-sm text-[#64748B]">Terms governing stationery sales, distribution, and commercial orders at DSL Enterprises.</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs text-xs sm:text-sm text-[#09285C]/80 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">1. Acceptance of Terms</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              By accessing or purchasing from DSL Enterprises (Pvt) Ltd, you agree to comply with our store policies, wholesale pricing schedules, and delivery agreements.
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">2. Pricing &amp; Currency</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              All prices listed on this website are denominated in Sri Lankan Rupees (LKR) and reflect official distributor rates. Promotional vouchers apply according to their specified terms.
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">3. Stock Availability &amp; Hold</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Inventory counts update in real-time. During checkout, stock holds are allocated to prevent race conditions. If an item becomes unavailable, equivalent authorized substitutes will be offered.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
