import React from 'react';
import { Truck, Clock, ShieldCheck, MapPin } from 'lucide-react';

export default function DeliveryPage() {
  return (
    <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-8 sm:py-16">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div className="space-y-2 text-center max-w-xl mx-auto">
          <span className="text-xs font-black uppercase tracking-wider text-[#0866E8] bg-[#EAF4FF] px-3.5 py-1 rounded-full border border-[#0866E8]/20">
            Islandwide Distribution
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-[#09285C] tracking-tight">
            Delivery Policy &amp; Rates
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Fast, secure stationery distribution across Colombo, Western Province, and all 25 districts in Sri Lanka.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs text-xs sm:text-sm text-[#09285C]/80 leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#EAF4FF]/60 border border-[#0866E8]/20 space-y-1">
              <strong className="text-sm sm:text-base font-bold text-[#09285C] block">Colombo &amp; Suburbs</strong>
              <p className="text-xs text-[#64748B]">1 – 2 business days standard dispatch directly from our Moratuwa fulfillment warehouse.</p>
            </div>
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F7FAFF] border border-slate-200/80 space-y-1">
              <strong className="text-sm sm:text-base font-bold text-[#09285C] block">Outstation Districts</strong>
              <p className="text-xs text-[#64748B]">2 – 3 business days via national courier network (Kandy, Galle, Matara, Kurunegala, Jaffna, etc.).</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">Delivery Rates (Sri Lankan Rupees)</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#64748B]">
              <li><strong className="text-[#09285C]">Free Delivery:</strong> All orders with a subtotal of Rs. 5,000 or above qualify for 100% Free Islandwide Shipping.</li>
              <li><strong className="text-[#09285C]">Standard Flat Rate:</strong> A standard flat shipping fee of Rs. 350 applies to orders below Rs. 5,000 anywhere in Sri Lanka.</li>
            </ul>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h2 className="text-sm sm:text-base font-black text-[#09285C]">Order Tracking &amp; Delivery Notification</h2>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Once your stationery order is dispatched from our Moratuwa fulfillment facility, you will receive an SMS and email
              containing your tracking details. The courier driver will contact your mobile phone prior to delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
