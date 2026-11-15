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
  Layout,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronLeft,
  Check,
  Link as LinkIcon,
  Megaphone,
} from 'lucide-react';
import { bannerService } from '@/services/bannerService';
import { HomepageBanner, BannerStatus, CreateBannerInput, UpdateBannerInput } from '@/types/banner';
import { BlueRibbonManager } from '@/components/admin/BlueRibbonManager';

const PLACEMENT_OPTIONS = [
  {
    value: 'HERO',
    label: 'Top Hero Slider',
    badge: '16:9 Carousel',
    desc: 'Widescreen banner in the top storefront slider',
    icon: Layout,
  },
  {
    value: 'MID_PAGE_PROMO',
    label: 'Mid-Page Promo',
    badge: 'Navy Wholesale Bar',
    desc: 'Wholesale promotion banner between product rows',
    icon: Sparkles,
  },
  {
    value: 'SPOTLIGHT',
    label: 'Spotlight Card',
    badge: 'Curated Block',
    desc: 'Featured category, brand, or seasonal highlight',
    icon: Layers,
  },
];

const QUICK_LINKS = [
  { label: 'Shop All', path: '/shop' },
  { label: 'Promotions', path: '/offers' },
  { label: 'School Packs', path: '/school-packs' },
  { label: 'Booklists', path: '/booklist-upload' },
  { label: 'Cart', path: '/cart' },
];

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Tab: Banners vs Blue Line Announcements
  const [activeTab, setActiveTab] = useState<'banners' | 'blueribbon'>('banners');

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | BannerStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [editingBanner, setEditingBanner] = useState<HomepageBanner | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isGraphicBanner, setIsGraphicBanner] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [desktopImage, setDesktopImage] = useState('');
  const [mobileImage, setMobileImage] = useState('');
  const [imageAltText, setImageAltText] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [placement, setPlacement] = useState<string>('HERO');
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
    setFormStep(1);
    setIsGraphicBanner(false);
    setTitle('');
    setSubtitle('');
    setDescription('');
    setDesktopImage('');
    setMobileImage('');
    setImageAltText('');
    setButtonText('');
    setButtonLink('');
    setPlacement('HERO');
    setSortOrder(banners.length > 0 ? Math.max(...banners.map((b) => b.sortOrder)) + 1 : 0);
    setStatus('DRAFT');
    setStartAt('');
    setEndAt('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (banner: HomepageBanner) => {
    setEditingBanner(banner);
    setFormStep(1);
    const isGraphic =
      banner.subtitle === '__GRAPHIC_ONLY__' ||
      (!banner.subtitle && !banner.description && !banner.buttonText);
    setIsGraphicBanner(isGraphic);
    setTitle(banner.title);
    setSubtitle(banner.subtitle === '__GRAPHIC_ONLY__' ? '' : (banner.subtitle || ''));
    setDescription(banner.description || '');
    setDesktopImage(banner.desktopImage);
    setMobileImage(banner.mobileImage || '');
    setImageAltText(banner.imageAltText);
    setButtonText(banner.buttonText || '');
    setButtonLink(banner.buttonLink || '');
    setPlacement(banner.placement || 'HERO');
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
      setFormError('Banner title is required (Step 1)');
      setFormStep(1);
      return;
    }
    if (!desktopImage.trim()) {
      setFormError('Desktop image is required (Step 2)');
      setFormStep(2);
      return;
    }
    if (!imageAltText.trim()) {
      setFormError('Image alt text is required for accessibility (Step 2)');
      setFormStep(2);
      return;
    }
    if (startAt && endAt && new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      setFormError('Schedule start date must be before end date (Step 3)');
      setFormStep(3);
      return;
    }

    try {
      setFormSubmitting(true);
      const payload: CreateBannerInput = {
        title: title.trim(),
        subtitle: isGraphicBanner ? '__GRAPHIC_ONLY__' : (subtitle.trim() || null),
        description: isGraphicBanner ? null : (description.trim() || null),
        desktopImage: desktopImage.trim(),
        mobileImage: mobileImage.trim() || null,
        imageAltText: imageAltText.trim() || title.trim(),
        buttonText: isGraphicBanner ? null : (buttonText.trim() || null),
        buttonLink: buttonLink.trim() || null,
        placement: placement || 'HERO',
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

      {/* Top Main Navigation Tabs: Store Banners vs Blue Line Advertisements */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('banners')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'banners'
              ? 'bg-[#08275E] text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Hero &amp; Promotional Banners</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blueribbon')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'blueribbon'
              ? 'bg-[#0866F5] text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Megaphone className="w-4 h-4 text-[#FFD84D]" />
          <span>Top Blue Line Advertisements</span>
          <span className="text-[10px] font-black uppercase bg-[#FFD84D] text-[#09285C] px-2 py-0.5 rounded-full shadow-2xs">
            Live Marquee
          </span>
        </button>
      </div>

      {activeTab === 'blueribbon' ? (
        <BlueRibbonManager />
      ) : (
        <>
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
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#0066CC]">
                      {banner.placement === 'MID_PAGE_PROMO'
                        ? 'Mid-Page Promo'
                        : banner.placement === 'SPOTLIGHT'
                        ? 'Spotlight Card'
                        : 'Hero Slide'}
                    </span>
                    {(banner.subtitle === '__GRAPHIC_ONLY__' || (!banner.subtitle && !banner.description && !banner.buttonText)) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                        <ImageIcon className="w-2.5 h-2.5" />
                        Ready-Made Graphic
                      </span>
                    )}
                    {getStatusBadge(banner)}
                  </div>

                  {banner.subtitle && banner.subtitle !== '__GRAPHIC_ONLY__' && (
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
      </>
      )}

      {/* CREATE / EDIT MODAL - WIZARD & GRID REDESIGN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 my-auto flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">
                    {editingBanner ? 'Edit Homepage Banner' : 'Create Homepage Banner'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#08275E] border border-blue-200">
                    Step {formStep} of 3
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Design storefront banners with live visual feedback and scheduling controls
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Tabs */}
            <div className="grid grid-cols-3 gap-2 my-4 shrink-0">
              {[
                { step: 1, label: 'Placement & Content', desc: 'Slot, Title & Copy', icon: Layout },
                { step: 2, label: 'Artwork & Media', desc: 'Desktop & Mobile Files', icon: ImageIcon },
                { step: 3, label: 'Action & Schedule', desc: 'Buttons, Status & Dates', icon: Calendar },
              ].map((s) => {
                const isCurrent = formStep === s.step;
                const isDone = formStep > s.step;
                const StepIcon = s.icon;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setFormStep(s.step as 1 | 2 | 3);
                    }}
                    className={`p-2.5 sm:p-3 rounded-2xl text-left transition-all border flex items-center gap-2.5 ${
                      isCurrent
                        ? 'bg-[#08275E]/5 border-[#08275E] text-[#08275E] shadow-xs'
                        : isDone
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isCurrent
                          ? 'bg-[#08275E] text-white shadow-xs'
                          : isDone
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : <StepIcon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{s.label}</div>
                      <div className="text-[10px] opacity-70 truncate hidden sm:block">{s.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Form Error Alert */}
            {formError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Body + Live Preview Grid */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pr-1 flex-1 py-1">
                {/* LEFT COLUMN: ACTIVE STEP INPUTS (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* STEP 1: PLACEMENT & CONTENT */}
                  {formStep === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Placement Slot Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-2">
                          Storefront Placement Slot <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {PLACEMENT_OPTIONS.map((opt) => {
                            const isSelected = placement === opt.value;
                            const IconComponent = opt.icon;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setPlacement(opt.value)}
                                className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                                  isSelected
                                    ? 'border-[#08275E] bg-blue-50/60 ring-2 ring-[#08275E]/15 shadow-xs'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                      isSelected ? 'bg-[#08275E] text-white' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    <IconComponent className="w-3.5 h-3.5" />
                                  </div>
                                  <span
                                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                      isSelected
                                        ? 'bg-[#08275E] text-white'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {opt.badge}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                    {opt.desc}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Ready-Made Graphic vs Custom Typography Style Switcher */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          Banner Format &amp; Style <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setIsGraphicBanner(true)}
                            className={`p-3 rounded-2xl text-left border transition-all flex items-start gap-2.5 ${
                              isGraphicBanner
                                ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-600/15 shadow-xs'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div
                              className={`p-2 rounded-xl shrink-0 ${
                                isGraphicBanner ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <ImageIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <span>Ready-Made Graphic Banner</span>
                                {isGraphicBanner && (
                                  <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                Artwork already contains typography &amp; visuals. No text overlay. Whole banner is clickable.
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsGraphicBanner(false)}
                            className={`p-3 rounded-2xl text-left border transition-all flex items-start gap-2.5 ${
                              !isGraphicBanner
                                ? 'border-[#08275E] bg-blue-50/70 ring-2 ring-[#08275E]/15 shadow-xs'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div
                              className={`p-2 rounded-xl shrink-0 ${
                                !isGraphicBanner ? 'bg-[#08275E] text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Layout className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                <span>Custom Typography Banner</span>
                                {!isGraphicBanner && (
                                  <span className="text-[9px] bg-[#08275E] text-white px-1.5 py-0.2 rounded-full font-bold">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                Headlines, subtitle badge, and CTA buttons are layered over the background image.
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Info banner for Ready-Made Graphic Banner */}
                      {isGraphicBanner && (
                        <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-2xl text-purple-900 text-xs flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>
                            <strong>Ready-Made Graphic Mode:</strong> Your uploaded image will be rendered with zero dark gradient and zero text overlay. Shoppers can click anywhere on the banner.
                          </span>
                        </div>
                      )}

                      {/* Banner Title / Reference Name */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-slate-700">
                            {isGraphicBanner
                              ? 'Banner Reference Name (For Admin & SEO) '
                              : 'Banner Main Headline '}
                            <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {title.length} characters
                          </span>
                        </div>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            if (!imageAltText || imageAltText === title) {
                              setImageAltText(e.target.value);
                            }
                          }}
                          placeholder={
                            isGraphicBanner
                              ? 'e.g. Back-to-School 20% Off Canva Poster Graphic'
                              : 'e.g. Back-to-School Stationery Sale or Wholesale Confidence'
                          }
                          className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E] transition-all bg-white"
                        />
                      </div>

                      {/* Subtitle / Promo Tag (Only for Custom Typography) */}
                      {!isGraphicBanner && (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Subtitle or Promo Badge <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              value={subtitle}
                              onChange={(e) => setSubtitle(e.target.value)}
                              placeholder="e.g. DISTRIBUTION PARTNER PROMOTION or Save Up to 35%"
                              className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E] transition-all bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Description / Secondary Body Text <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <textarea
                              rows={3}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Supporting message detailing the campaign, brands, or seasonal benefits..."
                              className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E] transition-all bg-white"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* STEP 2: ARTWORK & MEDIA */}
                  {formStep === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Desktop Image */}
                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800">
                            Desktop Image <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            Recommended: 1920×800 (16:9)
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            value={desktopImage}
                            onChange={(e) => setDesktopImage(e.target.value)}
                            placeholder="/images/hero/hero_section_2x.png or https://..."
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
                            className="px-3 py-2 bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 shadow-xs"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>{uploadingDesktop ? 'Uploading...' : 'Upload'}</span>
                          </button>
                        </div>

                        {desktopImage && (
                          <div className="relative h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                            <img
                              src={desktopImage}
                              alt="Desktop preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.dataset.retried && target.src.includes('/uploads/')) {
                                  target.dataset.retried = 'true';
                                  target.src = `http://localhost:4000${desktopImage.startsWith('/') ? '' : '/'}${desktopImage}`;
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setDesktopImage('')}
                                className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold hover:bg-rose-700 transition-colors"
                              >
                                Clear Image
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mobile Image */}
                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800">
                            Mobile Image Variant <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <span className="text-[10px] text-slate-500">Recommended: 800×1000 (4:5)</span>
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
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>{uploadingMobile ? 'Uploading...' : 'Upload'}</span>
                          </button>
                        </div>

                        {mobileImage && (
                          <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                            <img
                              src={mobileImage}
                              alt="Mobile preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.dataset.retried && target.src.includes('/uploads/')) {
                                  target.dataset.retried = 'true';
                                  target.src = `http://localhost:4000${mobileImage.startsWith('/') ? '' : '/'}${mobileImage}`;
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => setMobileImage('')}
                                className="p-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
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
                          placeholder="e.g. Back-to-school stationery bundles with Faber-Castell and Atlas notebooks"
                          className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E] bg-white"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Required for screen readers and search engine index optimization.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: ACTION & SCHEDULE */}
                  {formStep === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Destination Link / CTA */}
                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800">
                            {isGraphicBanner
                              ? 'Banner Click Destination'
                              : 'Call to Action Button'}{' '}
                            <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <span className="text-[10px] text-slate-500">
                            {isGraphicBanner
                              ? 'Clicking anywhere on the graphic navigates here'
                              : 'Links shopper to target page'}
                          </span>
                        </div>

                        {isGraphicBanner ? (
                          <div>
                            <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Destination URL / Page
                            </span>
                            <input
                              type="text"
                              value={buttonLink}
                              onChange={(e) => setButtonLink(e.target.value)}
                              placeholder="e.g. /shop, /offers, /school-packs, or https://..."
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <span className="block text-[11px] font-semibold text-slate-600 mb-1">Button Text</span>
                              <input
                                type="text"
                                value={buttonText}
                                onChange={(e) => setButtonText(e.target.value)}
                                placeholder="e.g. Shop Now or Explore Offers"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                              />
                            </div>

                            <div>
                              <span className="block text-[11px] font-semibold text-slate-600 mb-1">Button Destination Link</span>
                              <input
                                type="text"
                                value={buttonLink}
                                onChange={(e) => setButtonLink(e.target.value)}
                                placeholder="e.g. /shop, /offers, /school-packs"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                              />
                            </div>
                          </div>
                        )}

                        {/* Quick link chips */}
                        <div>
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Quick Destination Shortcuts:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_LINKS.map((quick) => (
                              <button
                                key={quick.path}
                                type="button"
                                onClick={() => {
                                  setButtonLink(quick.path);
                                  if (!isGraphicBanner && !buttonText) setButtonText(quick.label);
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-blue-50 text-slate-700 hover:text-[#08275E] border border-slate-200 transition-colors flex items-center gap-1"
                              >
                                <LinkIcon className="w-2.5 h-2.5 opacity-60" />
                                <span>{quick.label}</span>
                                <span className="text-slate-400 font-mono text-[9px]">({quick.path})</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Status Selection */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Publication Status
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { val: 'DRAFT', label: 'Draft', desc: 'Hidden' },
                            { val: 'PUBLISHED', label: 'Published', desc: 'Live now' },
                            { val: 'SCHEDULED', label: 'Scheduled', desc: 'Date timed' },
                            { val: 'ARCHIVED', label: 'Archived', desc: 'Retired' },
                          ].map((st) => {
                            const isSelected = status === st.val;
                            return (
                              <button
                                key={st.val}
                                type="button"
                                onClick={() => setStatus(st.val as BannerStatus)}
                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                  isSelected
                                    ? 'border-[#08275E] bg-blue-50 text-[#08275E] font-black ring-1 ring-[#08275E]'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                                }`}
                              >
                                <div className="text-xs">{st.label}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{st.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sort Order & Dates */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Sort Priority
                          </label>
                          <input
                            type="number"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">0 = first slide</span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Start Date &amp; Time
                          </label>
                          <input
                            type="datetime-local"
                            value={startAt}
                            onChange={(e) => setStartAt(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            End Date &amp; Time
                          </label>
                          <input
                            type="datetime-local"
                            value={endAt}
                            onChange={(e) => setEndAt(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: STICKY STOREFRONT MOCKUP PREVIEW (5 cols) */}
                <div className="lg:col-span-5 flex flex-col justify-between p-4 bg-slate-900 rounded-2xl text-white border border-slate-800 shadow-inner">
                  <div>
                    {/* Preview Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>Storefront Live Mockup</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isGraphicBanner && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-800">
                            Graphic Only
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800">
                          {placement}
                        </span>
                      </div>
                    </div>

                    {/* MOCKUP CONTENT BASED ON FORMAT & PLACEMENT */}
                    {isGraphicBanner ? (
                      /* Ready-Made Graphic Banner Preview: Crisp image, NO dark gradient, NO text overlay */
                      <div className="space-y-3">
                        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-purple-700/60 bg-slate-950 shadow-xl group">
                          {desktopImage ? (
                            <img
                              src={desktopImage}
                              alt="Ready-made graphic preview"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.dataset.retried && target.src.includes('/uploads/')) {
                                  target.dataset.retried = 'true';
                                  target.src = `http://localhost:4000${desktopImage.startsWith('/') ? '' : '/'}${desktopImage}`;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-linear-to-br from-slate-900 via-purple-950/60 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
                              <ImageIcon className="w-10 h-10 text-purple-400/60 mb-2" />
                              <span className="text-xs font-bold text-purple-200">
                                Upload Ready-Made Graphic Artwork
                              </span>
                              <span className="text-[10px] text-slate-400 mt-1">
                                Full artwork will display un-obscured with no dark overlay
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-800/40 text-[11px] text-purple-200 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 truncate">
                            <LinkIcon className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">
                              {buttonLink ? `Links to: ${buttonLink}` : 'No link set (Display only)'}
                            </span>
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-900 px-2 py-0.5 rounded-md shrink-0">
                            Full Click
                          </span>
                        </div>
                      </div>
                    ) : placement === 'MID_PAGE_PROMO' ? (
                      /* Section 5 Mid-Page Navy Promotion Preview */
                      <div className="rounded-2xl bg-[#08275E] border border-blue-900/60 p-5 shadow-lg relative overflow-hidden space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/25 text-blue-200 border border-blue-400/30">
                            {subtitle.trim() || 'DISTRIBUTION PARTNER PROMOTION'}
                          </span>
                          <span className="text-[10px] text-blue-300 font-semibold">Wholesale</span>
                        </div>

                        <div>
                          <h4 className="text-base font-black text-white leading-snug">
                            {title.trim() || 'Equip Classrooms & Workplaces With Wholesale Confidence.'}
                          </h4>
                          <p className="text-xs text-blue-100/75 mt-1.5 leading-relaxed line-clamp-3">
                            {description.trim() ||
                              'Direct distribution agreements with Atlas, Promate, and Faber-Castell guarantee authentic supplies at authoritative distributor pricing.'}
                          </p>
                        </div>

                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          <div className="px-3 py-1.5 bg-white text-[#08275E] font-black text-xs rounded-lg shadow-xs flex items-center gap-1">
                            <span>{buttonText.trim() || 'Shop New Releases'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </div>
                          {desktopImage && (
                            <span className="text-[10px] text-blue-300 bg-blue-950/60 px-2 py-1 rounded-md border border-blue-800/60">
                              Artwork attached
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Top Hero Slider or Spotlight Preview with Typography Overlay */
                      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-lg flex flex-col justify-end p-4">
                        {desktopImage ? (
                          <img
                            src={desktopImage}
                            alt="Preview"
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.dataset.retried && target.src.includes('/uploads/')) {
                                target.dataset.retried = 'true';
                                target.src = `http://localhost:4000${desktopImage.startsWith('/') ? '' : '/'}${desktopImage}`;
                              }
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-[#08275E] to-slate-800 opacity-90 flex items-center justify-center">
                            <ImageIcon className="w-10 h-10 text-slate-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                        <div className="relative z-10 space-y-1.5">
                          {subtitle && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-xs">
                              {subtitle}
                            </span>
                          )}
                          <h4 className="text-sm sm:text-base font-black text-white leading-tight drop-shadow-xs line-clamp-2">
                            {title.trim() || 'Your Hero Banner Title Here'}
                          </h4>
                          {description && (
                            <p className="text-[11px] text-slate-200 line-clamp-2 drop-shadow-xs">
                              {description}
                            </p>
                          )}
                          {buttonText && (
                            <div className="pt-1">
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-slate-900 rounded-lg text-xs font-bold shadow-xs">
                                {buttonText}
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview Footer note */}
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Mockup updates in real time as you adjust form inputs.</span>
                  </div>
                </div>
              </div>

              {/* MODAL FOOTER CONTROLS */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {formStep > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        setFormStep((prev) => (prev - 1) as 1 | 2 | 3);
                      }}
                      className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  )}

                  {formStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFormError(null);
                        if (formStep === 1) {
                          if (!title.trim()) {
                            setFormError('Please enter a banner title before proceeding.');
                            return;
                          }
                          setFormStep(2);
                        } else if (formStep === 2) {
                          if (!desktopImage.trim()) {
                            setFormError('Please provide a desktop image URL or upload an image.');
                            return;
                          }
                          if (!imageAltText.trim()) {
                            setFormError('Please provide image alt text for accessibility & SEO.');
                            return;
                          }
                          setFormStep(3);
                        }
                      }}
                      className="px-5 py-2 text-xs font-bold text-white bg-[#08275E] hover:bg-[#103b8c] rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {formSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Banner...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>{editingBanner ? 'Save Changes' : 'Publish Banner'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
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
