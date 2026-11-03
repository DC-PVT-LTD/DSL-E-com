import React from 'react';
import { Truck, Clock, ShieldCheck, MapPin } from 'lucide-react';

export default function DeliveryPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-8">
      <div className="space-y-2 text-center max-w-xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-wider text-[#08275E] bg-blue-50 px-3 py-1 rounded-full">
          Islandwide Shipping
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Delivery Policy &amp; Rates
        </h1>
        <p className="text-xs text-slate-500">
          Fast, safe stationery delivery across Colombo, suburbs, and all provinces in Sri Lanka.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs text-slate-600 leading-relaxed">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-1">
            <strong className="text-sm font-bold text-[#08275E] block">Colombo &amp; Suburbs</strong>
            <p>1 - 2 business days standard dispatch. Same-day urgent options available upon inquiry.</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <strong className="text-sm font-bold text-slate-900 block">Outstation Districts</strong>
            <p>2 - 3 business days via domestic courier partners (Galle, Kandy, Kurunegala, Jaffna, etc.).</p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Delivery Rates (Sri Lankan Rupees)</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Free Delivery:</strong> All orders with a subtotal of Rs. 5,000 or above qualify for 100% Free Shipping.</li>
            <li><strong>Flat Rate:</strong> A standard flat shipping fee of Rs. 350 applies to orders below Rs. 5,000 anywhere in Sri Lanka.</li>
          </ul>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Order Tracking &amp; Delivery Contact</h2>
          <p>
            Once your stationery order is dispatched from our Colombo fulfillment hub, you will receive an SMS and email
            containing your tracking number. The courier driver will contact your mobile phone prior to arriving at your delivery address.
          </p>
        </div>
      </div>
    </div>
  );
}
