'use client';

import React, { useState } from 'react';
import { X, User, Mail, Phone, Loader2, AlertCircle } from 'lucide-react';
import { orderService } from '@/services/orderService';

interface EditCustomerModalProps {
  orderId: string;
  initialCustomer: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: { customerName: string; customerEmail: string; customerPhone: string }) => void;
}

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  orderId,
  initialCustomer,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState(initialCustomer.customerName);
  const [email, setEmail] = useState(initialCustomer.customerEmail);
  const [phone, setPhone] = useState(initialCustomer.customerPhone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('A valid email address is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    const res = await orderService.updateCustomerInfo(orderId, {
      customerName: name.trim(),
      customerEmail: email.trim(),
      customerPhone: phone.trim(),
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccess({
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
      });
      onClose();
    } else {
      if (res.isBackendPending) {
        setNotice(res.error || 'Backend endpoint pending.');
      } else {
        setError(res.error || 'Failed to update customer information');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#08275E]/10 text-[#08275E]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Edit Customer Information</h3>
              <p className="text-[11px] text-slate-400">Update recipient and contact details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong className="block font-bold">API Coordination Notice:</strong>
                <span>{notice}</span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
              Customer Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kamal Perera"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.lk"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+94 77 123 4567"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
