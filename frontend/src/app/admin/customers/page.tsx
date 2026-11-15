'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  ArrowRight,
  MapPin,
  Mail,
  Phone,
  UserCheck,
  UserX,
  ShoppingBag,
  Calendar,
  Download,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Eye,
  Check,
  X,
} from 'lucide-react';
import { customerService } from '@/services/customerService';
import { CustomerListItem, CustomerAnalytics, CustomerQueryFilters } from '@/types/customer';
import { formatLKR } from '@/lib/currency';
import {
  CatalogKpiCards,
  KpiCardData,
  CatalogFilterToolbar,
  ActiveFilterChip,
  ColumnVisibilityDropdown,
  ColumnDefinition,
  CatalogPagination,
  CatalogExportModal,
} from '@/components/admin/catalog';

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { id: 'name', label: 'Customer Name', visible: true, locked: true },
  { id: 'email', label: 'Email Address', visible: true, locked: true },
  { id: 'phone', label: 'Telephone', visible: true },
  { id: 'primaryDistrict', label: 'Primary District', visible: true },
  { id: 'status', label: 'Account Status', visible: true },
  { id: 'orderCount', label: 'Orders Placed', visible: true },
  { id: 'totalSpend', label: 'Total Spent (LKR)', visible: true },
  { id: 'createdAt', label: 'Registration Date', visible: true },
  { id: 'actions', label: 'Actions', visible: true, locked: true },
];

export default function AdminCustomersPage() {
  // Data state
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'with_orders' | 'no_orders'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'email' | 'orderCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection & Export state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Column visibility state
  const [columns, setColumns] = useState<ColumnDefinition[]>(DEFAULT_COLUMNS);

  const isColVisible = (colId: string) => {
    return columns.find((c) => c.id === colId)?.visible ?? true;
  };

  // Status toggle modal state
  const [statusModalCustomer, setStatusModalCustomer] = useState<CustomerListItem | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await customerService.fetchCustomerAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      console.warn('Failed to load customer analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Load customers
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: CustomerQueryFilters = {
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter,
        hasOrders: ordersFilter,
        sortBy,
        sortOrder,
      };

      const result = await customerService.fetchCustomers(filters);
      setCustomers(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
      setError(err?.message || 'Failed to load customer directory.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, ordersFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleClearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setOrdersFilter('all');
    setPage(1);
  };

  // Active filter chips
  const activeChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (statusFilter !== 'all') {
      chips.push({
        id: 'status',
        label: 'Account Status',
        value: statusFilter === 'active' ? 'Active' : 'Suspended',
        onRemove: () => setStatusFilter('all'),
      });
    }
    if (ordersFilter !== 'all') {
      chips.push({
        id: 'orders',
        label: 'Order Activity',
        value: ordersFilter === 'with_orders' ? 'With Orders' : 'No Orders',
        onRemove: () => setOrdersFilter('all'),
      });
    }
    return chips;
  }, [statusFilter, ordersFilter]);

  // KPI Cards
  const kpiCards: KpiCardData[] = useMemo(() => {
    return [
      {
        id: 'total',
        label: 'Total Registered',
        value: analytics?.totalCustomers ?? '—',
        icon: <Users className="w-4 h-4" />,
        color: 'blue',
        active: statusFilter === 'all' && ordersFilter === 'all',
        onClick: handleClearAllFilters,
      },
      {
        id: 'active',
        label: 'Active Accounts',
        value: analytics?.activeCustomers ?? '—',
        icon: <UserCheck className="w-4 h-4" />,
        color: 'emerald',
        active: statusFilter === 'active',
        onClick: () => {
          setStatusFilter('active');
          setOrdersFilter('all');
          setPage(1);
        },
      },
      {
        id: 'inactive',
        label: 'Suspended Accounts',
        value: analytics?.inactiveCustomers ?? '—',
        icon: <UserX className="w-4 h-4" />,
        color: 'rose',
        active: statusFilter === 'inactive',
        onClick: () => {
          setStatusFilter('inactive');
          setOrdersFilter('all');
          setPage(1);
        },
      },
      {
        id: 'orders',
        label: 'Customers with Orders',
        value: analytics?.customersWithOrders ?? '—',
        icon: <ShoppingBag className="w-4 h-4" />,
        color: 'amber',
        active: ordersFilter === 'with_orders',
        onClick: () => {
          setOrdersFilter('with_orders');
          setStatusFilter('all');
          setPage(1);
        },
      },
    ];
  }, [analytics, statusFilter, ordersFilter]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(customers.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Status toggle submission
  const handleConfirmStatusToggle = async () => {
    if (!statusModalCustomer) return;
    setIsSubmittingStatus(true);
    try {
      const targetStatus = !statusModalCustomer.isActive;
      await customerService.updateCustomerStatus(
        statusModalCustomer.id,
        targetStatus,
        statusReason.trim() || undefined
      );

      await Promise.all([loadCustomers(), loadAnalytics()]);
      setStatusModalCustomer(null);
      setStatusReason('');
    } catch (err: any) {
      alert(err?.message || 'Failed to update customer status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Export action
  const handleExport = async (format: 'csv' | 'xlsx', scope: 'all' | 'selected') => {
    const idsToExport = scope === 'selected' ? selectedIds : undefined;
    const filters: CustomerQueryFilters = {
      search: search.trim() || undefined,
      status: statusFilter,
      hasOrders: ordersFilter,
    };
    const blob = await customerService.exportCustomers(format, filters, idsToExport);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsl-customers-${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Customer Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered customer accounts, contact details, delivery addresses, and real order histories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              loadCustomers();
              loadAnalytics();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Customers</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <CatalogKpiCards cards={kpiCards} isLoading={analyticsLoading} />

      {/* Filter & Search Toolbar */}
      <CatalogFilterToolbar
        searchQuery={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search customer name, email, phone, or ID..."
        activeChips={activeChips}
        onClearAll={handleClearAllFilters}
        totalResults={total}
        rightAction={
          <ColumnVisibilityDropdown
            columns={columns}
            onChange={setColumns}
            storageKey="dsl_catalog_cols_customers"
          />
        }
      >
        {/* Status Select */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setPage(1);
          }}
          aria-label="Filter customers by status"
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Accounts</option>
          <option value="inactive">Suspended Accounts</option>
        </select>

        {/* Order Activity Select */}
        <select
          value={ordersFilter}
          onChange={(e) => {
            setOrdersFilter(e.target.value as any);
            setPage(1);
          }}
          aria-label="Filter customers by order activity"
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Order Activities</option>
          <option value="with_orders">With Orders Placed</option>
          <option value="no_orders">No Orders Placed</option>
        </select>
      </CatalogFilterToolbar>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Error loading customer accounts</p>
            <p>{error}</p>
          </div>
          <button
            onClick={() => loadCustomers()}
            className="text-rose-700 underline font-bold hover:text-rose-900"
          >
            Try again
          </button>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase text-[10px]">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all customers on current page"
                    checked={
                      customers.length > 0 && selectedIds.length === customers.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-[#08275E] focus:ring-[#08275E]"
                  />
                </th>

                {isColVisible('name') && (
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === 'name') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('name');
                          setSortOrder('asc');
                        }
                      }}
                      className="hover:text-slate-900 flex items-center gap-1 font-bold"
                    >
                      Customer Name
                    </button>
                  </th>
                )}

                {isColVisible('email') && (
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === 'email') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('email');
                          setSortOrder('asc');
                        }
                      }}
                      className="hover:text-slate-900 flex items-center gap-1 font-bold"
                    >
                      Email Address
                    </button>
                  </th>
                )}

                {isColVisible('phone') && (
                  <th className="py-3.5 px-4">Telephone</th>
                )}

                {isColVisible('primaryDistrict') && (
                  <th className="py-3.5 px-4">Primary District</th>
                )}

                {isColVisible('status') && (
                  <th className="py-3.5 px-4">Account Status</th>
                )}

                {isColVisible('orderCount') && (
                  <th className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === 'orderCount') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('orderCount');
                          setSortOrder('desc');
                        }
                      }}
                      className="hover:text-slate-900 flex items-center gap-1 font-bold mx-auto"
                    >
                      Orders Placed
                    </button>
                  </th>
                )}

                {isColVisible('totalSpend') && (
                  <th className="py-3.5 px-4 text-right">Total Spent</th>
                )}

                {isColVisible('createdAt') && (
                  <th className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === 'createdAt') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('createdAt');
                          setSortOrder('asc');
                        }
                      }}
                      className="hover:text-slate-900 flex items-center gap-1 font-bold"
                    >
                      Registered At
                    </button>
                  </th>
                )}

                {isColVisible('actions') && (
                  <th className="py-3.5 px-4 text-right">Actions</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="w-4 h-4 bg-slate-200 rounded"></div>
                    </td>
                    {isColVisible('name') && (
                      <td className="py-4 px-4">
                        <div className="h-4 w-32 bg-slate-200 rounded mb-1"></div>
                        <div className="h-2.5 w-20 bg-slate-100 rounded"></div>
                      </td>
                    )}
                    {isColVisible('email') && (
                      <td className="py-4 px-4">
                        <div className="h-4 w-40 bg-slate-200 rounded"></div>
                      </td>
                    )}
                    {isColVisible('phone') && (
                      <td className="py-4 px-4">
                        <div className="h-4 w-24 bg-slate-200 rounded"></div>
                      </td>
                    )}
                    {isColVisible('primaryDistrict') && (
                      <td className="py-4 px-4">
                        <div className="h-4 w-20 bg-slate-200 rounded"></div>
                      </td>
                    )}
                    {isColVisible('status') && (
                      <td className="py-4 px-4">
                        <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
                      </td>
                    )}
                    {isColVisible('orderCount') && (
                      <td className="py-4 px-4 text-center">
                        <div className="h-4 w-12 bg-slate-200 rounded mx-auto"></div>
                      </td>
                    )}
                    {isColVisible('totalSpend') && (
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 w-20 bg-slate-200 rounded ml-auto"></div>
                      </td>
                    )}
                    {isColVisible('createdAt') && (
                      <td className="py-4 px-4">
                        <div className="h-4 w-24 bg-slate-200 rounded"></div>
                      </td>
                    )}
                    {isColVisible('actions') && (
                      <td className="py-4 px-4 text-right">
                        <div className="h-7 w-20 bg-slate-200 rounded-xl ml-auto"></div>
                      </td>
                    )}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.filter((c) => c.visible).length + 1}
                    className="py-16 text-center text-slate-400"
                  >
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No customers found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search || statusFilter !== 'all' || ordersFilter !== 'all'
                        ? 'Try clearing active search or status filters to view records.'
                        : 'No customer accounts registered yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  const regDate = new Date(c.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          aria-label={`Select customer ${c.name}`}
                          checked={isSelected}
                          onChange={() => handleToggleRow(c.id)}
                          className="rounded border-slate-300 text-[#08275E] focus:ring-[#08275E]"
                        />
                      </td>

                      {isColVisible('name') && (
                        <td className="py-3 px-4">
                          <Link
                            href={`/admin/customers/${c.id}`}
                            className="font-bold text-slate-900 hover:text-[#08275E] hover:underline block"
                          >
                            {c.name}
                          </Link>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {c.id.slice(0, 12)}...
                          </span>
                        </td>
                      )}

                      {isColVisible('email') && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{c.email}</span>
                          </div>
                          {c.isEmailVerified && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium mt-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          )}
                        </td>
                      )}

                      {isColVisible('phone') && (
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {c.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{c.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic">No phone</span>
                          )}
                        </td>
                      )}

                      {isColVisible('primaryDistrict') && (
                        <td className="py-3 px-4 text-slate-600">
                          {c.primaryDistrict ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{c.primaryDistrict}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic">Not set</span>
                          )}
                        </td>
                      )}

                      {isColVisible('status') && (
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setStatusModalCustomer(c);
                              setStatusReason('');
                            }}
                            title="Click to change account status"
                            className="inline-flex items-center gap-1.5 cursor-pointer group"
                          >
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                c.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {c.isActive ? (
                                <UserCheck className="w-3 h-3" />
                              ) : (
                                <UserX className="w-3 h-3" />
                              )}
                              <span>{c.isActive ? 'Active' : 'Suspended'}</span>
                            </span>
                          </button>
                        </td>
                      )}

                      {isColVisible('orderCount') && (
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block font-bold text-xs px-2.5 py-0.5 rounded-full ${
                              c.orderCount > 0
                                ? 'bg-blue-50 text-[#08275E] font-black'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {c.orderCount} {c.orderCount === 1 ? 'order' : 'orders'}
                          </span>
                        </td>
                      )}

                      {isColVisible('totalSpend') && (
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {formatLKR(c.totalSpendCents)}
                        </td>
                      )}

                      {isColVisible('createdAt') && (
                        <td className="py-3 px-4 text-slate-500">{regDate}</td>
                      )}

                      {isColVisible('actions') && (
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              href={`/admin/customers/${c.id}`}
                              className="bg-[#08275E] hover:bg-[#103b8c] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1 shadow-xs"
                            >
                              <span>View Profile</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination */}
        <CatalogPagination
          page={page}
          totalPages={totalPages}
          limit={limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          isLoading={loading}
        />
      </div>

      {/* Export Modal */}
      <CatalogExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        totalFilteredCount={total}
        selectedCount={selectedIds.length}
        title="Export Customers List"
      />

      {/* Account Status Toggle Modal */}
      {statusModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {statusModalCustomer.isActive ? 'Suspend Customer Account' : 'Reactivate Customer Account'}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalCustomer(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to{' '}
              <strong className={statusModalCustomer.isActive ? 'text-rose-600' : 'text-emerald-600'}>
                {statusModalCustomer.isActive ? 'SUSPEND' : 'REACTIVATE'}
              </strong>{' '}
              the customer account for <strong>{statusModalCustomer.name}</strong> ({statusModalCustomer.email})?
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Reason for change (Optional, will be recorded in audit log)
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Account suspended due to customer request or fraud verification..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStatusModalCustomer(null)}
                disabled={isSubmittingStatus}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                disabled={isSubmittingStatus}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-1.5 ${
                  statusModalCustomer.isActive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSubmittingStatus ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>
                  Confirm {statusModalCustomer.isActive ? 'Suspension' : 'Reactivation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
