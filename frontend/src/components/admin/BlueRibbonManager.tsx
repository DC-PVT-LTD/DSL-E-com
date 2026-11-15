'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Plus,
  Trash2,
  Edit,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  RotateCcw,
  X,
  Check,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import {
  announcementService,
  AnnouncementAd,
  DEFAULT_ANNOUNCEMENTS,
} from '@/services/announcementService';

export const BlueRibbonManager: React.FC = () => {
  const [ads, setAds] = useState<AnnouncementAd[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AnnouncementAd | null>(null);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load from announcementService on mount & subscribe to updates
  useEffect(() => {
    setAds(announcementService.getAll());

    const unsubscribe = announcementService.subscribe(() => {
      setAds(announcementService.getAll());
    });

    return () => unsubscribe();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const openCreateModal = () => {
    setEditingAd(null);
    setText('');
    setLink('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (ad: AnnouncementAd) => {
    setEditingAd(ad);
    setText(ad.text);
    setLink(ad.link || '');
    setIsActive(ad.isActive);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (editingAd) {
      announcementService.update(editingAd.id, {
        text: text.trim(),
        link: link.trim() || undefined,
        isActive,
      });
      showNotification('Announcement updated successfully!');
    } else {
      announcementService.add({
        text: text.trim(),
        link: link.trim() || undefined,
        isActive,
      });
      showNotification('New advertisement added to the blue line!');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this advertisement from the blue line?')) {
      announcementService.delete(id);
      showNotification('Advertisement removed.');
    }
  };

  const handleToggle = (id: string) => {
    announcementService.toggleActive(id);
    showNotification('Status updated.');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ads.length) return;

    const reordered = [...ads];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    announcementService.reorder(reordered.map((a) => a.id));
    showNotification('Order updated.');
  };

  const handleReset = () => {
    if (confirm('Reset the blue announcement line to default messages?')) {
      announcementService.resetToDefault();
      showNotification('Reset to default announcements.');
    }
  };

  const activeAds = ads.filter((a) => a.isActive);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-[#0866F5]">
              <Megaphone className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-[#09285C]">
              Top Blue Line Advertisements (Live Ticker)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Manage the scrolling advertisement messages that continuously flow to the right on the storefront’s top blue ribbon line between the header and hero banner.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset to default messages"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="bg-[#0866F5] hover:bg-[#0753C7] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Advertisement</span>
          </button>
        </div>
      </div>

      {/* Real-time Live Preview of the Blue Ribbon */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#09285C]">
            <Eye className="w-4 h-4 text-[#0866F5]" />
            <span>Live Storefront Preview ({activeAds.length} active announcements scrolling)</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            ● Live on Homepage
          </span>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-md border border-blue-600/40">
          <aside className="bg-[#0866F5] text-white text-xs font-black h-[40px] flex items-center overflow-hidden select-none relative z-10">
            {/* Edge gradient masks */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0866F5] to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0866F5] to-transparent z-10" />

            <div className="animate-marquee-right flex items-center whitespace-nowrap">
              {activeAds.length > 0 ? (
                [...activeAds, ...activeAds].map((ad, idx) => (
                  <div key={`preview-ad-${ad.id}-${idx}`} className="flex items-center gap-3 px-6 shrink-0">
                    <span className="tracking-wide uppercase text-[11px] sm:text-xs font-black">
                      {ad.text}
                    </span>
                    <span className="text-[#FFD84D] text-xs select-none">•</span>
                  </div>
                ))
              ) : (
                <div className="px-6 text-white/70 text-xs">No active announcements to display.</div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Announcements Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-[#09285C]">
            Configured Advertisements ({ads.length})
          </h3>
          <span className="text-xs text-slate-400">
            Drag or use arrows to adjust sequence order
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {ads.map((ad, index) => (
            <div
              key={ad.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                ad.isActive ? 'hover:bg-slate-50/80' : 'bg-slate-50/50 opacity-60'
              }`}
            >
              {/* Order & Content */}
              <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center shrink-0">
                  #{index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#09285C] break-words">
                      {ad.text}
                    </p>
                    {ad.isActive ? (
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                        Hidden
                      </span>
                    )}
                  </div>

                  {ad.link && (
                    <div className="flex items-center gap-1.5 text-xs text-[#0866F5] mt-1 font-medium">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">Links to: {ad.link}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {/* Reorder Arrows */}
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className="p-2 text-slate-500 hover:text-[#09285C] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === ads.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className="p-2 text-slate-500 hover:text-[#09285C] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle(ad.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    ad.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {ad.isActive ? 'Active' : 'Enable'}
                </button>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => openEditModal(ad)}
                  className="p-2 rounded-xl text-slate-500 hover:text-[#0866F5] hover:bg-blue-50 border border-slate-200 transition-colors"
                  title="Edit announcement"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(ad.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
                  title="Delete announcement"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {ads.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No advertisements found. Click &quot;Add New Advertisement&quot; to create one.
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-[#0866F5]">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="text-base font-black text-[#09285C]">
                  {editingAd ? 'Edit Blue Line Advertisement' : 'Add New Blue Line Advertisement'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Text Input */}
              <div>
                <label className="block text-xs font-bold text-[#09285C] uppercase tracking-wider mb-1.5">
                  Advertisement Message <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Save Up to 20% on all Doms Drawing Kits! 🎨"
                  className="w-full bg-[#F7FAFF] border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-[#09285C] placeholder-slate-400 focus:outline-hidden focus:border-[#0866F5] focus:bg-white focus:ring-2 focus:ring-[#0866F5]/20 font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Tip: Include relevant emojis (🎒, ✏️, 🚚, 📦, ✨) to make the marquee stand out.
                </p>
              </div>

              {/* Target Link Input */}
              <div>
                <label className="block text-xs font-bold text-[#09285C] uppercase tracking-wider mb-1.5">
                  Target Click URL / Destination (Optional)
                </label>
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="e.g. /school-packs or /shop?filter=best-sellers"
                  className="w-full bg-[#F7FAFF] border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-[#09285C] placeholder-slate-400 focus:outline-hidden focus:border-[#0866F5] focus:bg-white font-medium"
                />

                {/* Quick Link Chips */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] text-slate-400 font-bold">Quick destinations:</span>
                  {[
                    { label: 'Shop All', url: '/shop' },
                    { label: 'School Packs', url: '/school-packs' },
                    { label: 'Brands', url: '/brands' },
                    { label: 'Bulk Order', url: '/bulk-order' },
                  ].map((dest) => (
                    <button
                      key={dest.url}
                      type="button"
                      onClick={() => setLink(dest.url)}
                      className="text-[10px] font-bold text-[#0866F5] bg-blue-50 border border-blue-100 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors"
                    >
                      {dest.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-xs font-bold text-[#09285C] block">
                    Active on Storefront
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Immediately show this advertisement in the live scrolling blue line
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 accent-[#0866F5] rounded-md cursor-pointer"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-[#0866F5] hover:bg-[#0753C7] shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingAd ? 'Save Changes' : 'Add to Blue Line'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

