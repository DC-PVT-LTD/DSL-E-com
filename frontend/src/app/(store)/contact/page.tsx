'use client';

import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, AlertCircle, Check, Sparkles } from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-12">
      <div className="max-w-2xl text-center mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#0066CC] bg-[#C6E7FF]/30 px-3.5 py-1 rounded-full inline-flex items-center gap-1.5 border border-[#C6E7FF]/40">
          <Sparkles className="w-3.5 h-3.5" /> Customer Support
        </span>
        <h1 className="text-3xl sm:text-5xl font-black text-[#292525] tracking-tight">
          Get in Touch with DSL Stationery
        </h1>
        <p className="text-sm text-[#292525]/70">
          Have questions regarding school pack customizations, bulk orders, or your delivery?
        </p>
      </div>

      {/* Unconfigured Notice */}
      <div className="bg-[#FFF9D2] border border-[#FFD84D] rounded-2xl p-4 text-xs text-[#594300] flex items-start gap-3 shadow-xs">
        <AlertCircle className="w-5 h-5 text-[#B38A00] shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Contact Channel Notice:</strong> The contact numbers, physical addresses,
          and email addresses displayed below are demonstration placeholders. Submissions via this contact form
          are simulated and will not send actual emails.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-2 shadow-sm text-xs">
            <div className="w-10 h-10 rounded-2xl bg-[#C6E7FF]/30 text-[#0066CC] flex items-center justify-center mb-2">
              <Phone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#292525]">Hotline &amp; WhatsApp</h3>
            <p className="text-[#292525]/90 font-medium">+94 114 963 069 (Office)</p>
            <p className="text-[#0066CC] font-semibold">+94 772 355 530 (Mobile / WhatsApp)</p>
            <p className="text-[#292525]/50">Mon - Fri: 8:30 AM - 5:30 PM</p>
          </div>

          <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-2 shadow-sm text-xs">
            <div className="w-10 h-10 rounded-2xl bg-[#EBD5FA]/40 text-[#8629B3] flex items-center justify-center mb-2">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#292525]">Email Inquiries</h3>
            <p className="text-[#292525]/90 font-medium">info@dsltrading.com</p>
            <p className="text-[#292525]/50">Official DSL Enterprises Inquiry Desk</p>
          </div>

          <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-2 shadow-sm text-xs">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF9D2] text-[#B38A00] flex items-center justify-center mb-2">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#292525]">Head Office Hub</h3>
            <p className="text-[#292525]/90 font-medium">#147/1, Angulana Station Road,</p>
            <p className="text-[#292525]/70">Moratuwa, Sri Lanka</p>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 shadow-sm">
          <h2 className="text-base font-bold text-[#292525] mb-4">Send Us a Message</h2>

          {submitted ? (
            <div className="p-8 text-center text-xs space-y-2 bg-[#EBD5FA]/30 text-[#4A154B] rounded-2xl border border-[#CFA6E8]/50">
              <Check className="w-8 h-8 text-[#8629B3] mx-auto" />
              <p className="font-bold text-sm">Message Sent (Demo Mode)</p>
              <p>Thank you for reaching out! Our team will respond shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-[#292525] block mb-1.5">Your Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#292525] block mb-1.5">Your Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#292525] block mb-1.5">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Question about Grade 6 School Pack"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                />
              </div>

              <div>
                <label className="font-bold text-[#292525] block mb-1.5">Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="How can we assist you?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                />
              </div>

              <button
                type="submit"
                className="bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold text-xs px-7 py-3.5 rounded-full flex items-center gap-2 transition-all shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Message</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
