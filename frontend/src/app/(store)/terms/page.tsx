import React from 'react';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-8">
      <div className="space-y-2 text-center max-w-xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Terms of Service</h1>
        <p className="text-xs text-slate-500">Terms governing the use of the DSL Stationery e-commerce website.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs text-slate-600 leading-relaxed">
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900">1. Acceptance of Terms</h2>
          <p>
            By accessing or ordering from DSL Stationery, you agree to comply with our store policies, pricing rules,
            and delivery agreements.
          </p>
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">2. Pricing &amp; Currency</h2>
          <p>
            All prices listed on this website are in Sri Lankan Rupees (LKR) and include all applicable taxes.
            Discounts and promotions cannot be stacked unless explicitly authorized.
          </p>
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">3. Stock Availability</h2>
          <p>
            In the event that a stationery item or CR book variant becomes out of stock after order placement,
            our support team will offer an equivalent replacement or immediate refund for that item.
          </p>
        </div>
      </div>
    </div>
  );
}
