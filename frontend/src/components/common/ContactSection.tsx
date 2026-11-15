'use client';

import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, Check, Sparkles, MessageCircle } from 'lucide-react';

interface ContactSectionProps {
  title?: string;
  subtitle?: string;
  showBadge?: boolean;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  title = 'Get in Touch with DSL Enterprises',
  subtitle = 'Have questions regarding school packs, bulk orders, syllabus lists, or islandwide delivery? Our support and distribution team is ready to assist you.',
  showBadge = true,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  return (
    <section className="w-full space-y-8 sm:space-y-12">
      <div className="max-w-2xl text-center mx-auto space-y-2.5">
        {showBadge && (
          <span className="text-xs font-black uppercase tracking-wider text-[#0866E8] bg-[#EAF4FF] px-3.5 py-1 rounded-full inline-flex items-center gap-1.5 border border-[#0866E8]/20">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD84D]" /> Customer Support &amp; Enquiries
          </span>
        )}
        <h2 className="text-2xl sm:text-4xl font-black text-[#09285C] tracking-tight">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto items-start">
        {/* Contact Info Cards */}
        <div className="space-y-4">
          {/* Phone & WhatsApp */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-2 shadow-xs text-xs transition-shadow hover:shadow-md">
            <div className="w-10 h-10 rounded-2xl bg-[#EAF4FF] text-[#0866E8] flex items-center justify-center mb-2">
              <Phone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#09285C] text-sm">Direct Phone &amp; WhatsApp</h3>
            <p>
              <a
                href="tel:+94112009000"
                className="text-[#09285C] font-semibold hover:text-[#0866E8] transition-colors"
              >
                +94 11 200 9000 (Office Desk)
              </a>
            </p>
            <p>
              <a
                href="https://wa.me/94773553555"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0866E8] font-bold inline-flex items-center gap-1.5 hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>+94 77 355 3555 (WhatsApp)</span>
              </a>
            </p>
            <p className="text-[#64748B] text-[11px] pt-1 border-t border-slate-100">
              Monday – Friday: 8:30 AM – 5:30 PM
            </p>
          </div>

          {/* Email */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-2 shadow-xs text-xs transition-shadow hover:shadow-md">
            <div className="w-10 h-10 rounded-2xl bg-[#EAF4FF] text-[#0866E8] flex items-center justify-center mb-2">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#09285C] text-sm">Email Inquiries</h3>
            <p>
              <a
                href="mailto:info@dsl.lk"
                className="text-[#0866E8] font-bold hover:underline"
              >
                info@dsl.lk
              </a>
            </p>
            <p className="text-[#64748B] text-[11px]">
              Official DSL Enterprises Distribution &amp; Retail Desk
            </p>
          </div>

          {/* Location */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-2 shadow-xs text-xs transition-shadow hover:shadow-md">
            <div className="w-10 h-10 rounded-2xl bg-[#EAF4FF] text-[#0866E8] flex items-center justify-center mb-2">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[#09285C] text-sm">Moratuwa Headquarters</h3>
            <p className="text-[#09285C] font-semibold">DSL Enterprises (Pvt) Ltd</p>
            <p className="text-[#64748B] text-[11px]">Central Logistics &amp; Distribution Warehouse, Moratuwa, Sri Lanka</p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
          <h3 className="text-base sm:text-lg font-black text-[#09285C] mb-1">
            Send Us a Direct Message
          </h3>
          <p className="text-xs text-[#64748B] mb-5">
            Fill in your details below and our customer support team will reply within 24 hours.
          </p>

          {submitted ? (
            <div className="p-8 text-center text-xs space-y-2 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-200 animate-fade-in">
              <Check className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-sm">Message Sent Successfully</p>
              <p>Thank you for reaching out! Our distribution team will respond to your inquiry shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-[#09285C] block mb-1.5">Your Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kasun Perera"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#0866E8] focus:ring-2 focus:ring-[#0866E8]/20 transition-all text-[#09285C] bg-[#F7FAFF]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#09285C] block mb-1.5">Your Email</label>
                  <input
                    type="email"
                    required
                    placeholder="kasun@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#0866E8] focus:ring-2 focus:ring-[#0866E8]/20 transition-all text-[#09285C] bg-[#F7FAFF]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#09285C] block mb-1.5">Subject</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Bulk school order enquiry or product availability"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#0866E8] focus:ring-2 focus:ring-[#0866E8]/20 transition-all text-[#09285C] bg-[#F7FAFF]"
                />
              </div>

              <div>
                <label className="font-bold text-[#09285C] block mb-1.5">Your Message</label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Please describe your requirements, questions, or product requests..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#0866E8] focus:ring-2 focus:ring-[#0866E8]/20 transition-all text-[#09285C] bg-[#F7FAFF]"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#09285C] hover:bg-[#0866E8] text-white font-bold text-xs sm:text-sm px-8 py-3.5 rounded-2xl shadow-sm transition-all cursor-pointer touch-target"
              >
                <Send className="w-4 h-4" />
                <span>Send Message</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

