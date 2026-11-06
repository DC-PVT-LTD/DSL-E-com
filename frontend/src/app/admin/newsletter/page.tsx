'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Search,
  Download,
  History,
  RefreshCw,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Globe,
  FileSpreadsheet,
} from 'lucide-react';
import { newsletterService } from '@/services/newsletterService';
import {
  NewsletterSubscriber,
  NewsletterSubscriberStatus,
  NewsletterCounts,
  NewsletterConsentEvent,
} from '@/types/newsletter';

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [counts, setCounts] = useState<NewsletterCounts>({
    total: 0,
    verified: 0,
    pending: 0,
    unsubscribed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | NewsletterSubscriberStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Consent History Modal state
  const [selectedSubscriber, setSelectedSubscriber] = useState<NewsletterSubscriber | null>(null);
  const [consentHistory, setConsentHistory] = useState<NewsletterConsentEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await newsletterService.getAdminSubscribers({
        page,
        limit: 15,
        status: statusFilter,
        search: searchQuery,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setSubscribers(res.items);
      setCounts(res.counts);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.totalItems);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscribers');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSubscribers();
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await newsletterService.downloadExportCsv();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to export subscribers CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenHistory = async (subscriber: NewsletterSubscriber) => {
    setSelectedSubscriber(subscriber);
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await newsletterService.getAdminConsentHistory(subscriber.id);
      setConsentHistory(res.events);
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load consent history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: NewsletterSubscriberStatus) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>VERIFIED</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>PENDING</span>
          </span>
        );
      case 'UNSUBSCRIBED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            <UserX className="w-3.5 h-3.5 text-slate-500" />
            <span>UNSUBSCRIBED</span>
          </span>
        );
      default:
        return <span className="text-xs font-bold text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Mail className="w-7 h-7 text-[#0066CC]" />
            <span>Newsletter &amp; Consent Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track double opt-in subscribers, review immutable consent records, and export marketing recipients
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSubscribers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh subscriber list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting || counts.verified === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Download CSV of eligible verified subscribers"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exporting ? 'Exporting...' : 'Export Eligible CSV'}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Subscribers
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0066CC] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{counts.total}</p>
          <span className="text-[11px] text-slate-400">All registered intents</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Verified (Opt-in)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{counts.verified}</p>
          <span className="text-[11px] text-emerald-600 font-medium">
            {counts.total > 0 ? `${Math.round((counts.verified / counts.total) * 100)}% verified` : '0%'}
          </span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pending Verification
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{counts.pending}</p>
          <span className="text-[11px] text-amber-600">Awaiting link click</span>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Unsubscribed
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-700 mt-2">{counts.unsubscribed}</p>
          <span className="text-[11px] text-slate-400">Excluded from marketing</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto w-full md:w-auto">
          {(['ALL', 'VERIFIED', 'PENDING', 'UNSUBSCRIBED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Subscribers Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-100 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Consent Source</th>
                <th className="py-3.5 px-4">Consent Date</th>
                <th className="py-3.5 px-4">Verification Date</th>
                <th className="py-3.5 px-4">Unsubscribe Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066CC]" />
                    <span>Loading subscriber records...</span>
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600">No subscribers found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery
                        ? 'Try clearing your search query or filters.'
                        : 'No newsletter subscriptions matching the selected criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {sub.email}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(sub.status)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-md">
                        {sub.consentSource}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {formatDate(sub.consentGivenAt)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {formatDate(sub.verifiedAt)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {formatDate(sub.unsubscribedAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenHistory(sub)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[#0066CC] font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
                        title="View immutable consent audit trail"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Consent Audit</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{subscribers.length}</strong> of{' '}
            <strong className="text-slate-800">{totalItems}</strong> subscribers
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-700 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Consent History Audit Modal */}
      {selectedSubscriber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#0066CC] uppercase tracking-wider">
                  Consent Audit History
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  {selectedSubscriber.email}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSubscriber(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {loadingHistory ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066CC]" />
                  <span>Loading consent audit trail...</span>
                </div>
              ) : historyError ? (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{historyError}</span>
                </div>
              ) : consentHistory.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No historical events recorded for this subscriber.
                </p>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {consentHistory.map((evt) => (
                    <div key={evt.id} className="relative space-y-1">
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#0066CC] border-2 border-white" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          {evt.eventType.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(evt.createdAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500">Source:</span>
                          <span className="font-mono text-slate-800">{evt.consentSource}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-semibold text-slate-500">Version:</span>
                          <span className="font-mono text-slate-800">{evt.consentTextVersion}</span>
                        </div>
                        {evt.metadata && (
                          <div className="pt-1 text-[10px] text-slate-500 font-mono">
                            {JSON.stringify(evt.metadata)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedSubscriber(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

