import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-8">
      <div className="space-y-2 text-center max-w-xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Privacy Policy</h1>
        <p className="text-xs text-slate-500">How DSL Stationery collects and protects your customer data.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs text-slate-600 leading-relaxed">
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-900">1. Information Collection</h2>
          <p>
            We collect personal information necessary for fulfilling stationery deliveries in Sri Lanka: your name,
            contact phone number, email address, and shipping destination.
          </p>
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">2. Booklist Uploads Privacy</h2>
          <p>
            Images and PDF documents uploaded via our &ldquo;Upload Your List&rdquo; service are used exclusively to extract
            stationery items for your order. We do not sell or share student booklists with external advertising networks.
          </p>
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">3. Demonstration Disclaimer</h2>
          <p>
            This website is currently a frontend prototype demonstration. User sessions, wishlist data, and mock orders
            are stored strictly in local browser storage and can be reset at any time using the Reset Demo Data button.
          </p>
        </div>
      </div>
    </div>
  );
}
