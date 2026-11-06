'use client';

import React, { useState } from 'react';
import { X, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { ShippingAddress } from '@/types/order';
import { orderService } from '@/services/orderService';

interface EditDeliveryModalProps {
  orderId: string;
  initialAddress: ShippingAddress;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: ShippingAddress) => void;
}

const SRI_LANKA_DISTRICTS = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
];

export const EditDeliveryModal: React.FC<EditDeliveryModalProps> = ({
  orderId,
  initialAddress,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [addressLine1, setAddressLine1] = useState(initialAddress.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(initialAddress.addressLine2 || '');
  const [city, setCity] = useState(initialAddress.city || '');
  const [district, setDistrict] = useState(initialAddress.district || 'Colombo');
  const [postalCode, setPostalCode] = useState(initialAddress.postalCode || '');
  const [deliveryNotes, setDeliveryNotes] = useState(initialAddress.deliveryNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLine1.trim()) {
      setError('Address Line 1 is required.');
      return;
    }
    if (!city.trim()) {
      setError('City is required.');
      return;
    }
    if (!district.trim()) {
      setError('District is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    const updatedData: ShippingAddress = {
      ...initialAddress,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      district: district.trim(),
      postalCode: postalCode.trim() || undefined,
      deliveryNotes: deliveryNotes.trim() || undefined,
    };

    const res = await orderService.updateDeliveryInfo(orderId, updatedData);
    setIsSubmitting(false);

    if (res.success) {
      onSuccess(updatedData);
      onClose();
    } else {
      if (res.isBackendPending) {
        setNotice(res.error || 'Backend endpoint pending.');
      } else {
        setError(res.error || 'Failed to update delivery address');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#08275E]/10 text-[#08275E]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Edit Delivery Details</h3>
              <p className="text-[11px] text-slate-400">Modify destination address and courier instructions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
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
              Address Line 1 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="e.g. 45/2 Temple Road"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
              Address Line 2 (Optional)
            </label>
            <input
              type="text"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="e.g. Suite 4B or Landmark"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Colombo 03"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                District <span className="text-rose-500">*</span>
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
              >
                {SRI_LANKA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
              Postal Code
            </label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="00300"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
              Delivery Instructions / Notes
            </label>
            <textarea
              rows={2}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Special instructions for driver (e.g., call before arriving)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
            />
          </div>

          {/* Footer */}
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
              <span>Save Delivery Details</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
