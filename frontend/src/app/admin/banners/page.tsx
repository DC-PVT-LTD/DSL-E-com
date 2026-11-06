'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Eye,
  Trash2,
  Copy,
  Edit,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  X,
  ExternalLink,
  Laptop,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { bannerService } from '@/services/bannerService';
import { HomepageBanner, BannerStatus, CreateBannerInput, UpdateBannerInput } from '@/types/banner';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | BannerStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<HomepageBanner | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [desktopImage, setDesktopImage] = useState('');
  const [mobileImage, setMobileImage] = useState('');
  const [imageAltText, setImageAltText] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [status, setStatus] = useState<BannerStatus>('DRAFT');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  // Upload state
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal state
  const [previewBanner, setPreviewBanner] = useState<HomepageBanner | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Action states
  const [busyBannerId, setBusyBannerId] = useState<string | null>(null);

  // Load banners on mount or filter change
  const loadBanners = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { status?: BannerStatus; search?: string } = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await bannerService.getAdminBanners(params);
      setBanners(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, [statusFilter]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const openCreateModal = () => {
    setEditingBanner(null);
    setTitle('');
    setSubtitle('');
    setDescription('');
    setDesktopImage('');
    setMobileImage('');
    setImageAltText('');
    setButtonText('');
    setButtonLink('');
    setSortOrder(banners.length > 0 ? Math.max(...banners.map((b) => b.sortOrder)) + 1 : 0);
    setStatus('DRAFT');
    setStartAt('');
    setEndAt('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (banner: HomepageBanner) => {
    setEditingBanner(banner);
    setTitle(banner.title);
    setSubtitle(banner.subtitle || '');
    setDescription(banner.description || '');
    setDesktopImage(banner.desktopImage);
    setMobileImage(banner.mobileImage || '');
    setImageAltText(banner.imageAltText);
    setButtonText(banner.buttonText || '');
    setButtonLink(banner.buttonLink || '');
    setSortOrder(banner.sortOrder);
    setStatus(banner.status);
    setStartAt(banner.startAt ? new Date(banner.startAt).toISOString().slice(0, 16) : '');
    setEndAt(banner.endAt ? new Date(banner.endAt).toISOString().slice(0, 16) : '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (file: File, target: 'desktop' | 'mobile') => {
    try {
      if (target === 'desktop') setUploadingDesktop(true);
      else setUploadingMobile(true);

      const url = await bannerService.uploadBannerImage(file);
      if (target === 'desktop') {
        setDesktopImage(url);
      } else {
        setMobileImage(url);
      }
    } catch (err: any) {
      setFormError(err?.message || `Failed to upload ${target} image`);
    } finally {
      if (target === 'desktop') setUploadingDesktop(false);
      else setUploadingMobile(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!desktopImage.trim()) {
      setFormError('Desktop image is required');
      return;
    }
    if (!imageAltText.trim()) {
      setFormError('Image alt text is required for accessibility');
      return;
    }
    if (startAt && endAt && new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      setFormError('Schedule start date must be before end date');
      return;
    }

    try {
      setFormSubmitting(true);
      const payload: CreateBannerInput = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        desktopImage: desktopImage.trim(),
        mobileImage: mobileImage.trim() || null,
        imageAltText: imageAltText.trim(),
        buttonText: buttonText.trim() || null,
        buttonLink: buttonLink.trim() || null,
        sortOrder: Number(sortOrder),
        status,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
      };

      if (editingBanner) {
        await bannerService.updateBanner(editingBanner.id, payload as UpdateBannerInput);
        showNotification(`Banner "${title}" updated successfully`);
      } else {
        await bannerService.createBanner(payload);
        showNotification(`Banner "${title}" created successfully`);
      }

      setIsModalOpen(false);
      loadBanners();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save banner');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (banner: HomepageBanner) => {
    if (!window.confirm(`Are you sure you want to delete banner "${banner.title}"?`)) {
      return;
    }
    try {
      setBusyBannerId(banner.id);
      await bannerService.deleteBanner(banner.id);
      showNotification(`Banner "${banner.title}" deleted successfully`);
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete banner');
    } finally {
      setBusyBannerId(null);
    }
  };

  const handleDuplicate = async (banner: HomepageBanner) => {
    try {
      setBusyBannerId(banner.id);
      const duplicate = await bannerService.duplicateBanner(banner.id);
      showNotification(`Duplicated as "${duplicate.title}" (Draft)`);
      loadBanners();
    } catch (err: any) {
      alert(err?.message || 'Failed to duplicate banner');
    } finally {
      setBusyBannerId(null);
    }
  };

  const handleMoveOrder = async (bannerIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? bannerIndex - 1 : bannerIndex + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const newBanners = [...banners];
    const currentBanner = newBanners[bannerIndex];
    const targetBanner = newBanners[targetIndex];

    // Swap sortOrders
    const tempOrder = currentBanner.sortOrder;
    currentBanner.sortOrder = targetBanner.sortOrder;
    targetBanner.sortOrder = tempOrder;

    // Swap positions in list
    newBanners[bannerIndex] = targetBanner;
    newBanners[targetIndex] = currentBanner;

    setBanners(newBanners);

    try {
      await bannerService.reorderBanners(
        newBanners.map((b, idx) => ({ id: b.id, sortOrder: idx }))
      );
      showNotification('Banner order updated');
    } catch (err: any) {
      alert(err?.message || 'Failed to update banner order');
      loadBanners();
    }
  };

  const getStatusBadge = (banner: HomepageBanner) => {
    const effective = banner.effectiveStatus || banner.status;
    switch (effective) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active on Store
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Calendar className="w-3.5 h-3.5" />
            Scheduled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <Clock className="w-3.5 h-3.5" />
            Expired
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Draft
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {effective}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#08275E]/10 rounded-xl text-[#08275E]">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Homepage Banner Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage promotional hero sliders, campaign schedules, and mobile-friendly banners
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={loadBanners}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Refresh banners"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Banner</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'PUBLISHED', 'SCHEDULED', 'DRAFT', 'ARCHIVED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === s
                  ? 'bg-[#08275E] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s === 'ALL' ? 'All Banners' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadBanners();
          }}
          className="relative max-w-sm w-full"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, subtitle, or CTA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
          />
        </form>
      </div>

      {/* Banners List / Cards */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <RefreshCw className="w-8 h-8 text-[#08275E] animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading homepage banners...</p>
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Banners Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {statusFilter !== 'ALL' || searchQuery
              ? 'No banners match the selected filter criteria. Try adjusting your search or filters.'
              : 'You have not created any homepage banners yet. Add your first promotional hero banner to greet visitors!'}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-[#08275E] text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#103b8c] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Banner
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 transition-all"
            >
              {/* Left Column: Sort Controls & Thumbnails */}
              <div className="flex items-center gap-4 w-full lg:w-auto">
                {/* Sort Order Up/Down */}
                <div className="flex flex-col items-center justify-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shrink-0">
                  <button
                    onClick={() => handleMoveOrder(index, 'up')}
                    disabled={index === 0}
                    className="p-1 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move banner up in display order"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono font-bold text-slate-700 px-1">
                    #{banner.sortOrder}
                  </span>
                  <button
                    onClick={() => handleMoveOrder(index, 'down')}
                    disabled={index === banners.length - 1}
                    className="p-1 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move banner down in display order"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Banner Thumbnail (Desktop) */}
                <div className="relative w-36 sm:w-44 h-20 sm:h-24 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shrink-0 group">
                  <img
                    src={banner.desktopImage}
                    alt={banner.imageAltText}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/hero/hero_section_2x.png';
                    }}
                  />
                  <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <Laptop className="w-2.5 h-2.5" /> Desktop
                  </div>
                  {banner.mobileImage && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <Smartphone className="w-2.5 h-2.5" /> Mobile
                    </div>
                  )}
                </div>

                {/* Title & Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-base font-black text-slate-900 truncate">{banner.title}</h3>
                    {getStatusBadge(banner)}
                  </div>

                  {banner.subtitle && (
                    <p className="text-xs text-slate-600 line-clamp-1 mb-1">{banner.subtitle}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    {banner.buttonText && (
                      <span className="inline-flex items-center gap-1 text-[#08275E] font-semibold">
                        CTA: &quot;{banner.buttonText}&quot; {banner.buttonLink && `(${banner.buttonLink})`}
                      </span>
                    )}

                    {(banner.startAt || banner.endAt) && (
                      <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {banner.startAt ? new Date(banner.startAt).toLocaleDateString() : 'Immediate'} →{' '}
                        {banner.endAt ? new Date(banner.endAt).toLocaleDateString() : 'Ongoing'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-1.5 self-end lg:self-center border-t lg:border-t-0 pt-3 lg:pt-0 w-full lg:w-auto justify-end">
                <button
                  onClick={() => {
                    setPreviewBanner(banner);
                    setPreviewViewport('desktop');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Preview banner rendering"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => openEditModal(banner)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Edit banner"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleDuplicate(banner)}
                  disabled={busyBannerId === banner.id}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  title="Duplicate banner as draft"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDelete(banner)}
                  disabled={busyBannerId === banner.id}
                  className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                  title="Delete banner"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {editingBanner ? 'Edit Homepage Banner' : 'Create Homepage Banner'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set imagery, typography, call-to-action buttons, and scheduling window
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* Title & Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Banner Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Back-to-School Stationery Sale"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subtitle (Optional)
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. Save up to 35% on bundles"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Body Text (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional secondary text displayed on the hero card..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                />
              </div>

              {/* Desktop Image Upload & URL */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Desktop Image (Widescreen Hero) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Recommended: 1920×800 or 16:9</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={desktopImage}
                    onChange={(e) => setDesktopImage(e.target.value)}
                    placeholder="/images/hero/hero_section_2x.png or /uploads/..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 bg-white rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                  <input
                    ref={desktopFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'desktop');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => desktopFileInputRef.current?.click()}
                    disabled={uploadingDesktop}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{uploadingDesktop ? 'Uploading...' : 'Upload'}</span>
                  </button>
                </div>

                {desktopImage && (
                  <div className="relative h-28 rounded-xl overflow-hidden border border-slate-200">
                    <img
                      src={desktopImage}
                      alt="Desktop preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Mobile Image Upload & URL */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Mobile Image (Optional Vertical Variant)
                  </label>
                  <span className="text-[10px] text-slate-500">Recommended: 800×1000 or 4:5</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mobileImage}
                    onChange={(e) => setMobileImage(e.target.value)}
                    placeholder="Defaults to desktop image if left blank"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 bg-white rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                  <input
                    ref={mobileFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'mobile');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => mobileFileInputRef.current?.click()}
                    disabled={uploadingMobile}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{uploadingMobile ? 'Uploading...' : 'Upload'}</span>
                  </button>
                </div>

                {mobileImage && (
                  <div className="relative h-28 w-28 rounded-xl overflow-hidden border border-slate-200">
                    <img
                      src={mobileImage}
                      alt="Mobile preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Image Alt Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Image Alt Text (SEO &amp; Accessibility) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={imageAltText}
                  onChange={(e) => setImageAltText(e.target.value)}
                  placeholder="e.g. Atlas and Doms Stationery Sale with vibrant notebooks and pencils"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                />
              </div>

              {/* Call to Action: Button Text & Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Button Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="e.g. Shop Now, Explore Offers"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Button Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={buttonLink}
                    onChange={(e) => setButtonLink(e.target.value)}
                    placeholder="e.g. /home or /categories/pens"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                </div>
              </div>

              {/* Status, Sort Order, Scheduling */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as BannerStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  >
                    <option value="DRAFT">Draft (Hidden)</option>
                    <option value="PUBLISHED">Published (Visible)</option>
                    <option value="SCHEDULED">Scheduled (Follows dates)</option>
                    <option value="ARCHIVED">Archived (Retired)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sort Order (Lower appears first)
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                </div>
              </div>

              {/* Scheduling Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Date &amp; Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    End Date &amp; Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#08275E] hover:bg-[#103b8c] rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingBanner ? 'Save Changes' : 'Create Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIVE PREVIEW MODAL */}
      {previewBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-700 text-white flex flex-col max-h-[90vh]">
            {/* Header & Viewport switcher */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Live Storefront Preview</h3>
                <p className="text-xs text-slate-400">
                  Rendering: &quot;{previewBanner.title}&quot;
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setPreviewViewport('desktop')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      previewViewport === 'desktop' ? 'bg-[#08275E] text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" /> Desktop
                  </button>
                  <button
                    onClick={() => setPreviewViewport('mobile')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      previewViewport === 'mobile' ? 'bg-[#08275E] text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile
                  </button>
                </div>

                <button
                  onClick={() => setPreviewBanner(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Frame */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              {previewViewport === 'desktop' ? (
                /* Desktop Preview Frame */
                <div className="w-full relative rounded-2xl overflow-hidden aspect-[16/7] shadow-2xl border border-slate-800 flex items-center justify-center">
                  <img
                    src={previewBanner.desktopImage}
                    alt={previewBanner.imageAltText}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-r from-black/60 via-black/30 to-transparent flex flex-col justify-center px-10 max-w-xl">
                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-md">
                      {previewBanner.title}
                    </h2>
                    {previewBanner.subtitle && (
                      <p className="text-sm text-[#FFD84D] font-bold mt-2 drop-shadow-xs">
                        {previewBanner.subtitle}
                      </p>
                    )}
                    {previewBanner.description && (
                      <p className="text-xs text-slate-200 mt-2 line-clamp-2 drop-shadow-xs">
                        {previewBanner.description}
                      </p>
                    )}
                    {previewBanner.buttonText && (
                      <div className="mt-4">
                        <span className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#FFD84D] text-[#10285D] text-xs font-black shadow-lg">
                          {previewBanner.buttonText}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Mobile Preview Frame */
                <div className="w-[320px] relative rounded-3xl overflow-hidden aspect-[9/16] shadow-2xl border-4 border-slate-700 flex flex-col justify-end p-5">
                  <img
                    src={previewBanner.mobileImage || previewBanner.desktopImage}
                    alt={previewBanner.imageAltText}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
                  <div className="relative z-10 space-y-2">
                    <h2 className="text-xl font-black text-white leading-tight drop-shadow-md">
                      {previewBanner.title}
                    </h2>
                    {previewBanner.subtitle && (
                      <p className="text-xs text-[#FFD84D] font-bold drop-shadow-xs">
                        {previewBanner.subtitle}
                      </p>
                    )}
                    {previewBanner.buttonText && (
                      <div className="pt-2">
                        <span className="w-full inline-flex items-center justify-center py-2 rounded-full bg-[#FFD84D] text-[#10285D] text-xs font-black shadow-lg">
                          {previewBanner.buttonText}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
