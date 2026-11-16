'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Check,
  AlertCircle,
  Building2,
  CreditCard,
  Truck,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { FREE_DELIVERY_THRESHOLD_CENTS, STANDARD_DELIVERY_FEE_CENTS } from '@/lib/currency';
import {
  storeSettingsService,
  AdminStoreSettingsResponse,
} from '@/services/storeSettingsService';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';
import { useUserStore } from '@/services/userStore';
import { SensitiveActionConfirmationModal } from '@/components/admin/security/SensitiveActionConfirmationModal';

export default function AdminSettingsPage() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const canManageFinancial = hasPermission('settings.financial');
  const [showStepUpModal, setShowStepUpModal] = useState(false);
  // Store Identity & Delivery (Local/Initial)
  const [storeName, setStoreName] = useState('DSL Stationery');
  const [currency] = useState('LKR (Sri Lankan Rupee)');
  const [freeThreshold, setFreeThreshold] = useState(FREE_DELIVERY_THRESHOLD_CENTS / 100);
  const [standardFee, setStandardFee] = useState(STANDARD_DELIVERY_FEE_CENTS / 100);
  const [hotline, setHotline] = useState('+94 11 200 9000');
  const [whatsappNumber, setWhatsappNumber] = useState('+94 77 123 4567');

  // Bank Transfer Configuration State
  const [bankTransferEnabled, setBankTransferEnabled] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [referenceInstructions, setReferenceInstructions] = useState('');
  const [bankLogoUrl, setBankLogoUrl] = useState('');

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [originalSettings, setOriginalSettings] = useState<AdminStoreSettingsResponse | null>(null);

  // Load live settings from Admin API
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const data = await storeSettingsService.getAdminSettings();
        if (!isMounted) return;

        setOriginalSettings(data);
        if (data?.hotlinePhone) setHotline(data.hotlinePhone);
        if (data?.whatsappNumber) setWhatsappNumber(data.whatsappNumber);
        if (data?.freeDeliveryThresholdCents) setFreeThreshold(data.freeDeliveryThresholdCents / 100);
        if (data?.flatDeliveryFeeCents) setStandardFee(data.flatDeliveryFeeCents / 100);

        // Bank Transfer
        setBankTransferEnabled(Boolean(data?.bankTransferEnabled));
        if (data?.bankTransfer) {
          setBankName(data.bankTransfer.bankName || '');
          setAccountHolderName(data.bankTransfer.accountHolderName || '');
          setAccountNumber(data.bankTransfer.accountNumber || '');
          setBranchName(data.bankTransfer.branchName || '');
          setBranchCode(data.bankTransfer.branchCode || '');
          setBankCode(data.bankTransfer.bankCode || '');
          setPaymentInstructions(data.bankTransfer.paymentInstructions || '');
          setReferenceInstructions(data.bankTransfer.referenceInstructions || '');
          setBankLogoUrl(data.bankTransfer.bankLogoUrl || '');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Failed to load store settings from server.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const validateBankFields = (): boolean => {
    const errors: Record<string, string> = {};

    if (bankTransferEnabled) {
      if (!bankName.trim()) errors.bankName = 'Bank name is required when Bank Transfer is enabled.';
      if (!accountHolderName.trim()) errors.accountHolderName = 'Account holder name is required.';
      if (!accountNumber.trim()) errors.accountNumber = 'Account number is required.';
      if (!branchName.trim()) errors.branchName = 'Branch name is required.';
      if (!paymentInstructions.trim()) errors.paymentInstructions = 'Payment instructions are required for customers.';
      if (!referenceInstructions.trim()) errors.referenceInstructions = 'Reference instructions are required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReset = () => {
    if (!originalSettings) return;
    setFieldErrors({});
    setErrorMessage(null);
    setBankTransferEnabled(Boolean(originalSettings.bankTransferEnabled));
    if (originalSettings.bankTransfer) {
      setBankName(originalSettings.bankTransfer.bankName || '');
      setAccountHolderName(originalSettings.bankTransfer.accountHolderName || '');
      setAccountNumber(originalSettings.bankTransfer.accountNumber || '');
      setBranchName(originalSettings.bankTransfer.branchName || '');
      setBranchCode(originalSettings.bankTransfer.branchCode || '');
      setBankCode(originalSettings.bankTransfer.bankCode || '');
      setPaymentInstructions(originalSettings.bankTransfer.paymentInstructions || '');
      setReferenceInstructions(originalSettings.bankTransfer.referenceInstructions || '');
      setBankLogoUrl(originalSettings.bankTransfer.bankLogoUrl || '');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateBankFields()) {
      return;
    }

    setShowStepUpModal(true);
  };

  const executeSave = async (confirmationPhrase?: string) => {
    try {
      setIsSubmitting(true);

      const updated = await storeSettingsService.updateBankTransfer(
        {
          bankTransferEnabled,
          bankName: bankName.trim(),
          accountHolderName: accountHolderName.trim(),
          accountNumber: accountNumber.trim(),
          branchName: branchName.trim(),
          branchCode: branchCode.trim() || undefined,
          bankCode: bankCode.trim() || undefined,
          paymentInstructions: paymentInstructions.trim(),
          referenceInstructions: referenceInstructions.trim(),
          bankLogoUrl: bankLogoUrl.trim() || undefined,
        },
        confirmationPhrase
      );

      setOriginalSettings(updated);
      setSaveSuccess(true);
      setShowStepUpModal(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save bank transfer configuration.');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfigComplete = Boolean(
    bankName.trim() &&
    accountHolderName.trim() &&
    accountNumber.trim() &&
    branchName.trim() &&
    paymentInstructions.trim() &&
    referenceInstructions.trim()
  );

  return (
    <AdminPageAccess permission="settings.view" pageTitle="Store Settings">
      <div className="max-w-4xl space-y-6 pb-12">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-[#08275E]" />
            Application &amp; Store Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure business rules, payment gateway accounts, delivery pricing thresholds, and customer channels.
          </p>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Settings Update Failed</p>
              <p className="text-rose-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 text-xs animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">Bank Transfer configuration successfully updated and saved to audit log!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* PAYMENT SETTINGS -> BANK TRANSFER CARD */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#08275E] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Payment Settings &mdash; Bank Transfer
                    </h2>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Corporate banking instructions and direct deposit verification settings
                  </p>
                </div>
              </div>

              {/* Availability Status Badge */}
              <div className="flex items-center gap-2">
                {bankTransferEnabled ? (
                  isConfigComplete ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active on Checkout
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Incomplete (Suppressed)
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    Disabled
                  </span>
                )}
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div className="space-y-0.5 pr-4">
                <label htmlFor="toggle-bank" className="font-bold text-slate-900 block cursor-pointer">
                  Enable Bank Transfer as a Customer Payment Option
                </label>
                <p className="text-slate-500 text-[11px]">
                  When enabled, customers can choose Bank Transfer and view these details. Requires all mandatory fields.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  id="toggle-bank"
                  type="checkbox"
                  checked={bankTransferEnabled}
                  onChange={(e) => {
                    setBankTransferEnabled(e.target.checked);
                    if (!e.target.checked) setFieldErrors({});
                  }}
                  className="sr-only peer"
                  disabled={isLoading || isSubmitting}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:width-5 after:w-5 after:transition-all peer-checked:bg-[#08275E]"></div>
              </label>
            </div>

            {/* Bank Account Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Bank Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Commercial Bank of Ceylon"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs ${fieldErrors.bankName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                    }`}
                />
                {fieldErrors.bankName && (
                  <span className="text-rose-600 text-[11px] mt-1 block">{fieldErrors.bankName}</span>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Account Holder Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. DSL Stationery (Pvt) Ltd"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs ${fieldErrors.accountHolderName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                    }`}
                />
                {fieldErrors.accountHolderName && (
                  <span className="text-rose-600 text-[11px] mt-1 block">{fieldErrors.accountHolderName}</span>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Account Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1000123456"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold ${fieldErrors.accountNumber ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                    }`}
                />
                {fieldErrors.accountNumber && (
                  <span className="text-rose-600 text-[11px] mt-1 block">{fieldErrors.accountNumber}</span>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Branch Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. City Office Branch"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs ${fieldErrors.branchName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                    }`}
                />
                {fieldErrors.branchName && (
                  <span className="text-rose-600 text-[11px] mt-1 block">{fieldErrors.branchName}</span>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Branch Code <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 001"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Bank Code <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7010"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">
                  Optional Bank Logo Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://dslstationery.lk/images/banks/combank.png"
                  value={bankLogoUrl}
                  onChange={(e) => setBankLogoUrl(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  HTTPS link to transparent bank brand mark displayed on the checkout receipt selector.
                </span>
              </div>
            </div>

            {/* Customer Instructions */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Payment Instructions for Customer <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Please deposit the exact order total to our bank account. Use your Order ID or contact mobile number as the payment reference."
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs ${fieldErrors.paymentInstructions ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                    }`}
                />
                {fieldErrors.paymentInstructions && (
                  <span className="text-rose-600 text-[11px] mt-1 block">{fieldErrors.paymentInstructions}</span>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reference Instructions for Customer <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter the 6 to 12 digit bank transaction reference or deposit slip number."
                  value={referenceInstructions}
                  onChange={(e) => setReferenceInstructions(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs ${fieldErrors.referenceInstructions ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                    }`}
                />
                {fieldErrors.referenceInstructions && (
                  <span className="text-rose-600 text-[11px] mt-1 block">{fieldErrors.referenceInstructions}</span>
                )}
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All updates are cryptographically logged with administrator identity and masked account numbers.</span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading || isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>

                {canManageFinancial ? (
                  <button
                    type="submit"
                    disabled={isLoading || isSubmitting}
                    className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Saving...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-[#FFD21C]" />
                        <span>Save Bank Settings</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-4 py-2 rounded-xl">
                    Requires settings.financial
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* STORE IDENTITY & GENERAL SETTINGS CARD */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs opacity-90">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#08275E]" />
                Store Identity &amp; Contact Channels
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Business Name</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50"
                    disabled
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Store Currency</label>
                  <input
                    type="text"
                    disabled
                    value={currency}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Support Hotline</label>
                  <input
                    type="text"
                    value={hotline}
                    onChange={(e) => setHotline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50"
                    disabled
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Official WhatsApp Business Number</label>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50"
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#08275E]" />
                Delivery Calculation Thresholds (LKR)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Free Delivery Minimum Cart (Rs.)</label>
                  <input
                    type="number"
                    value={freeThreshold}
                    onChange={(e) => setFreeThreshold(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                    disabled
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Carts above this value automatically receive Rs. 0 delivery in Colombo and Islandwide.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Standard Islandwide Fee (Rs.)</label>
                  <input
                    type="number"
                    value={standardFee}
                    onChange={(e) => setStandardFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                    disabled
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Standard courier flat shipping rate.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Sensitive Action Typed Confirmation Modal */}
        <SensitiveActionConfirmationModal
          isOpen={showStepUpModal}
          onClose={() => setShowStepUpModal(false)}
          actionTitle="Update Store Financial & Bank Settings"
          actionDescription="Modify corporate bank account details and customer bank transfer payment settings"
          targetResourceType="StoreSettings"
          targetResourceName="default"
          expectedConfirmationPhrase="CONFIRM FINANCIAL SETTINGS"
          confirmButtonLabel="Confirm & Save Settings"
          impactWarning="Changes to corporate bank accounts and instructions will immediately affect checkout deposit verification for all customers."
          onConfirmed={async (phrase) => {
            await executeSave(phrase);
          }}
        />
      </div>
    </AdminPageAccess>
  );
}
