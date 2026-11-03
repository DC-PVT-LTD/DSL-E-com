import React from 'react';
import { RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ReturnsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-8">
      <div className="space-y-2 text-center max-w-xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-wider text-[#08275E] bg-blue-50 px-3 py-1 rounded-full">
          Customer Protection
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Returns &amp; Refunds Policy
        </h1>
        <p className="text-xs text-slate-500">
          Our commitment to ensuring satisfaction with every exercise book, pen pack, and school bundle.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs text-slate-600 leading-relaxed">
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">7-Day Return Guarantee</h2>
          <p>
            If you receive damaged goods, incorrect rulings (e.g. ordered single line but received square rule),
            or defective pens, you can request an exchange or full refund within 7 days of package delivery.
          </p>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Return Eligibility Criteria</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Item must be in its original packaging (unopened pen sets, plastic-sealed CR bundles).</li>
            <li>Proof of purchase (Order Number) must be provided.</li>
            <li>Customized school packs can be returned in full or item-by-item if defective.</li>
          </ul>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Refund Processing</h2>
          <p>
            Refunds for card payments are credited back within 3-5 business days. For cash on delivery orders,
            refunds are issued via direct bank transfer to your Sri Lankan commercial bank account.
          </p>
        </div>
      </div>
    </div>
  );
}
