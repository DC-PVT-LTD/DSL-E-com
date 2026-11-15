import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-8 sm:py-16">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div className="space-y-2 text-center max-w-xl mx-auto">
          <span className="text-xs font-black uppercase tracking-wider text-[#0866E8] bg-[#EAF4FF] px-3.5 py-1 rounded-full border border-[#0866E8]/20">
            Data Protection
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-[#09285C] tracking-tight">Privacy Policy</h1>
          <p className="text-xs sm:text-sm text-[#64748B]">How DSL Enterprises collects, uses, and safeguards customer data.</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs text-xs sm:text-sm text-[#09285C]/80 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">1. Information Collection</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              We collect contact information necessary for fulfilling stationery deliveries across Sri Lanka: customer name,
              contact telephone/WhatsApp number, email address, and physical delivery address.
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">2. Booklist Uploads Privacy</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Images and PDF documents uploaded via our &ldquo;Upload Booklist&rdquo; service are processed exclusively to extract
              curriculum items for your shopping cart. Uploaded lists are never shared or sold to third parties.
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">3. Security Standards</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              All communication is encrypted via TLS/SSL. Customer account credentials and session tokens are protected with industry-standard cryptographic hashing and secure HTTP cookies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
