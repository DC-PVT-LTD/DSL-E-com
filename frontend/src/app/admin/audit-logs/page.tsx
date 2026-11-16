'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  History,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  X,
  ExternalLink,
  Eye,
  Calendar,
  Lock,
  Package,
  ShoppingCart,
  Users,
  Layers,
  Settings,
  Tag,
  Clock,
  User,
  Info,
  ChevronRight,
  Database,
} from 'lucide-react';
import { UnifiedAuditLogEntry, AuditSummaryResponse, AuditSourceType } from '@/types/audit';
import { auditService } from '@/services/auditService';
import { useUserStore } from '@/services/userStore';
import { CatalogKpiCards, KpiCardData, CatalogPagination } from '@/components/admin/catalog';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'PRODUCT_CREATE', label: 'PRODUCT_CREATE' },
  { value: 'PRODUCT_UPDATE', label: 'PRODUCT_UPDATE' },
  { value: 'PRODUCT_DELETE', label: 'PRODUCT_DELETE' },
  { value: 'STATUS_CHANGE', label: 'STATUS_CHANGE (Order)' },
  { value: 'DELIVERY_UPDATE', label: 'DELIVERY_UPDATE (Order)' },
  { value: 'CUSTOMER_UPDATE', label: 'CUSTOMER_UPDATE (Order)' },
  { value: 'NOTE_ADDED', label: 'NOTE_ADDED (Order)' },
  { value: 'CUSTOMER_STATUS_UPDATE', label: 'CUSTOMER_STATUS_UPDATE' },
  { value: 'CATEGORY_CREATE', label: 'CATEGORY_CREATE' },
  { value: 'CATEGORY_DELETE', label: 'CATEGORY_DELETE' },
  { value: 'BRAND_CREATE', label: 'BRAND_CREATE' },
  { value: 'VARIANT_CREATE', label: 'VARIANT_CREATE' },
  { value: 'VARIANT_UPDATE', label: 'VARIANT_UPDATE' },
  { value: 'STORE_SETTINGS_UPDATE', label: 'STORE_SETTINGS_UPDATE' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'All Entity Types' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'ORDER', label: 'Order' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'BRAND', label: 'Brand' },
  { value: 'VARIANT', label: 'Variant' },
  { value: 'SETTINGS', label: 'Store Settings' },
  { value: 'INVENTORY', label: 'Inventory' },
];

export default function AdminAuditLogsPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === 'ADMIN';

  // Data states
  const [logs, setLogs] = useState<UnifiedAuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AuditSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeSource, setActiveSource] = useState<AuditSourceType>('ALL');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Detail Modal state
  const [selectedEntry, setSelectedEntry] = useState<UnifiedAuditLogEntry | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load summary metrics
  const loadSummary = useCallback(async () => {
    if (!isAdmin) return;
    setSummaryLoading(true);
    try {
      const data = await auditService.fetchAuditSummary();
      setSummary(data);
    } catch (err: any) {
      console.warn('Failed to load audit summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [isAdmin]);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await auditService.fetchAuditLogs({
        page,
        limit,
        search: debouncedSearch.trim() || undefined,
        source: activeSource,
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err?.message || 'Failed to retrieve audit log history.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, limit, debouncedSearch, activeSource, actionFilter, entityFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setActiveSource('ALL');
    setActionFilter('');
    setEntityFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      search.trim() ||
      activeSource !== 'ALL' ||
      actionFilter ||
      entityFilter ||
      dateFrom ||
      dateTo
    );
  }, [search, activeSource, actionFilter, entityFilter, dateFrom, dateTo]);

  // KPI card definitions
  const kpiCards: KpiCardData[] = useMemo(() => {
    return [
      {
        id: 'total',
        label: 'Total Audit Events',
        value: summary?.totalEvents ?? '—',
        subtitle: 'All-time system & order logs',
        icon: <History className="w-4 h-4" />,
        color: 'blue',
        active: activeSource === 'ALL' && !hasActiveFilters,
        onClick: () => {
          setActiveSource('ALL');
          setPage(1);
        },
      },
      {
        id: 'general',
        label: 'System & Catalog Logs',
        value: summary?.generalAuditEvents ?? '—',
        subtitle: 'AuditLog source records',
        icon: <Database className="w-4 h-4" />,
        color: 'emerald',
        active: activeSource === 'AUDIT_LOG',
        onClick: () => {
          setActiveSource('AUDIT_LOG');
          setPage(1);
        },
      },
      {
        id: 'orders',
        label: 'Order Lifecycle Logs',
        value: summary?.orderAuditEvents ?? '—',
        subtitle: 'OrderAuditLog source records',
        icon: <ShoppingCart className="w-4 h-4" />,
        color: 'purple',
        active: activeSource === 'ORDER_AUDIT_LOG',
        onClick: () => {
          setActiveSource('ORDER_AUDIT_LOG');
          setPage(1);
        },
      },
      {
        id: 'today',
        label: 'Recorded Today',
        value: summary?.todayEvents ?? '—',
        subtitle: 'Asia/Colombo business day',
        icon: <Clock className="w-4 h-4" />,
        color: 'amber',
      },
    ];
  }, [summary, activeSource, hasActiveFilters]);

  // Formatter for action pill styles
  const getActionBadge = (action: string, source: 'AUDIT_LOG' | 'ORDER_AUDIT_LOG') => {
    const isOrder = source === 'ORDER_AUDIT_LOG' || action.includes('ORDER') || action.includes('STATUS');
    if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('DEACTIVATE')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('CREATE') || action.includes('CONFIRM') || action.includes('ACTIVATE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (isOrder) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const getEntityIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'PRODUCT':
      case 'VARIANT':
        return <Package className="w-3.5 h-3.5 text-blue-500" />;
      case 'ORDER':
        return <ShoppingCart className="w-3.5 h-3.5 text-purple-500" />;
      case 'CUSTOMER':
      case 'USER':
        return <Users className="w-3.5 h-3.5 text-emerald-500" />;
      case 'CATEGORY':
      case 'BRAND':
        return <Layers className="w-3.5 h-3.5 text-indigo-500" />;
      case 'SETTINGS':
        return <Settings className="w-3.5 h-3.5 text-slate-500" />;
      default:
        return <Tag className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // If user is not an Admin, show access restriction
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Audit Logs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor and investigate administrative and system activities across the platform.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-amber-50/60 border border-amber-200 text-center max-w-xl mx-auto space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-600 mt-1">
              Audit logs contain authoritative, immutable records of system and financial mutations. Access is strictly restricted to System Administrators.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminPageAccess permission="audit_logs.view" pageTitle="Audit Logs">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Audit Logs
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                <span>Admin Protected</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Monitor and investigate administrative and system activities across the platform.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadAuditLogs();
                loadSummary();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Refresh Audit Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Metric Cards */}
        <CatalogKpiCards cards={kpiCards} isLoading={summaryLoading} />

        {/* Audit Source Tabs */}
        <div className="flex items-center border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveSource('ALL');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeSource === 'ALL'
                ? 'border-[#08275E] text-[#08275E] bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
          >
            <History className="w-4 h-4" />
            <span>All Audit Sources</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              {summary?.totalEvents ?? '—'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSource('AUDIT_LOG');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeSource === 'AUDIT_LOG'
                ? 'border-[#08275E] text-[#08275E] bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
          >
            <Database className="w-4 h-4" />
            <span>System &amp; Catalog</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {summary?.generalAuditEvents ?? '—'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSource('ORDER_AUDIT_LOG');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeSource === 'ORDER_AUDIT_LOG'
                ? 'border-[#08275E] text-[#08275E] bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Order Lifecycle</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              {summary?.orderAuditEvents ?? '—'}
            </span>
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action, description, reason, entity ID, order #, or actor..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#08275E] focus:outline-none transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${showAdvancedFilters || actionFilter || entityFilter || dateFrom || dateTo
                    ? 'bg-blue-50 border-blue-200 text-[#08275E]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
                {(actionFilter || entityFilter || dateFrom || dateTo) && (
                  <span className="w-2 h-2 rounded-full bg-[#08275E]" />
                )}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Expandable Advanced Filters */}
          {showAdvancedFilters && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Action Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Action Name
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:outline-none"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Type Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Entity Type
                </label>
                <select
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:outline-none"
                >
                  {ENTITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Date From (Colombo)
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:outline-none"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Date To (Colombo)
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Audit Logs Table */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                  <div className="h-4 bg-slate-200 rounded w-28" />
                  <div className="h-4 bg-slate-200 rounded w-24" />
                  <div className="h-4 bg-slate-200 rounded w-36" />
                  <div className="h-4 bg-slate-200 rounded w-48" />
                  <div className="h-4 bg-slate-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-900">{error}</p>
              <button
                type="button"
                onClick={loadAuditLogs}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <History className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-900">No audit events found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'Try clearing active filters or modifying search keywords.'
                  : 'No administrative mutations or order events have been logged yet.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 select-none">
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Timestamp</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Actor</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Action</th>
                    <th className="py-3 px-4 font-bold">Description / Reason</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Entity</th>
                    <th className="py-3 px-4 font-bold whitespace-nowrap">Source</th>
                    <th className="py-3 px-4 font-bold text-right whitespace-nowrap">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const date = new Date(log.timestamp);
                    const isOrder = log.entityType === 'ORDER';

                    return (
                      <tr
                        key={`${log.source}-${log.id}`}
                        onClick={() => setSelectedEntry(log)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Timestamp */}
                        <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {date.toLocaleDateString('en-GB', {
                              timeZone: 'Asia/Colombo',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {date.toLocaleTimeString('en-GB', {
                              timeZone: 'Asia/Colombo',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-slate-800">{log.actor.name}</span>
                          </div>
                          {log.actor.email && (
                            <div className="text-[10px] text-slate-400 font-mono pl-5">
                              {log.actor.email}
                            </div>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${getActionBadge(
                              log.action,
                              log.source
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 text-slate-700 font-medium max-w-md">
                          <p className="line-clamp-2">{log.description}</p>
                          {log.fieldChanged && (
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                              Field changed: {log.fieldChanged}
                            </span>
                          )}
                        </td>

                        {/* Entity */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {getEntityIcon(log.entityType)}
                            <span className="font-bold text-[11px] text-slate-800 uppercase">
                              {log.entityType}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {isOrder && log.orderNumber ? (
                              <Link
                                href={`/admin/orders/${log.entityId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-purple-600 hover:underline inline-flex items-center gap-0.5"
                              >
                                <span>{log.orderNumber}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            ) : (
                              <span title={log.entityId}>
                                {log.entityId.length > 18
                                  ? `${log.entityId.slice(0, 16)}...`
                                  : log.entityId}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Source */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {log.source === 'ORDER_AUDIT_LOG' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              OrderAuditLog
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              AuditLog
                            </span>
                          )}
                        </td>

                        {/* Details View */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntry(log);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View Complete Audit Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Server-Side Pagination */}
          {!loading && logs.length > 0 && (
            <CatalogPagination
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
              isLoading={loading}
            />
          )}
        </div>

        {/* Audit Detail Slide-over / Modal */}
        {selectedEntry && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden text-xs">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-100 text-[#08275E]">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Audit Record Details</h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      ID: {selectedEntry.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Event Attributes Grid */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Action
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold border mt-0.5 ${getActionBadge(
                        selectedEntry.action,
                        selectedEntry.source
                      )}`}
                    >
                      {selectedEntry.action}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Source
                    </span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                      {selectedEntry.source}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Timestamp (Colombo)
                    </span>
                    <span className="text-slate-700 font-mono text-[11px] mt-0.5 block">
                      {new Date(selectedEntry.timestamp).toLocaleString('en-GB', {
                        timeZone: 'Asia/Colombo',
                      })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Actor / User
                    </span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                      {selectedEntry.actor.name}{' '}
                      {selectedEntry.actor.role && (
                        <span className="text-[10px] font-normal text-slate-500">
                          ({selectedEntry.actor.role})
                        </span>
                      )}
                    </span>
                    {selectedEntry.actor.email && (
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {selectedEntry.actor.email}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Entity Type
                    </span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                      {selectedEntry.entityType}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Entity ID
                    </span>
                    <span className="font-mono text-slate-700 text-[11px] mt-0.5 block truncate" title={selectedEntry.entityId}>
                      {selectedEntry.entityId}
                    </span>
                  </div>

                  {selectedEntry.orderNumber && (
                    <div className="col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Related Order
                      </span>
                      <Link
                        href={`/admin/orders/${selectedEntry.entityId}`}
                        className="text-purple-600 hover:underline font-bold text-xs inline-flex items-center gap-1 mt-0.5"
                      >
                        <span>{selectedEntry.orderNumber}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Event Description */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-600">Event Description / Reason</span>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed font-medium">
                    {selectedEntry.description || selectedEntry.reason || 'No description provided.'}
                  </div>
                </div>

                {/* Previous vs New Values (For Order Audit Logs) */}
                {(selectedEntry.previousValue || selectedEntry.newValue || selectedEntry.fieldChanged) && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">Mutation Changes</span>
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Previous Value
                        </span>
                        <span className="font-mono text-rose-700 text-[11px] break-all">
                          {selectedEntry.previousValue ?? 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          New Value
                        </span>
                        <span className="font-mono text-emerald-700 text-[11px] break-all">
                          {selectedEntry.newValue ?? 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Structured Metadata / Changes Diff */}
                {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">
                        Structured Metadata (Sensitive Fields Redacted)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">JSON</span>
                    </div>
                    <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-60">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Security & Integrity Note */}
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 flex items-start gap-2.5 text-slate-600 text-[11px]">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    This audit event is an immutable system record. IP address: <strong>{selectedEntry.ipAddress}</strong>. Historical audit logs cannot be edited or deleted.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPageAccess>
  );
}
