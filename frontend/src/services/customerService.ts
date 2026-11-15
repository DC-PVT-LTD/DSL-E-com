import {
  CustomerListItem,
  CustomerDetail,
  CustomerAnalytics,
  CustomerQueryFilters,
} from '@/types/customer';
import { PaginatedResult } from '@/types/common';
import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';

class CustomerService {
  /**
   * Fetches paginated customers with server-side filters.
   */
  public async fetchCustomers(
    filters: CustomerQueryFilters = {}
  ): Promise<PaginatedResult<CustomerListItem>> {
    const params: Record<string, string | number | boolean | undefined> = {
      page: filters.page || 1,
      limit: filters.limit || 25,
      search: filters.search || filters.q,
      status: filters.status && filters.status !== 'all' ? filters.status : undefined,
      hasOrders: filters.hasOrders && filters.hasOrders !== 'all' ? filters.hasOrders : undefined,
      district: filters.district,
      startDate: filters.startDate,
      endDate: filters.endDate,
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc',
    };

    const res = await apiClient.get<
      BackendApiResponse<CustomerListItem[]> & {
        pagination?: { page: number; limit: number; total: number; totalPages: number };
      }
    >('admin/customers', {
      params,
    });

    if (res.success && Array.isArray(res.data)) {
      const total = res.pagination?.total ?? res.data.length;
      const page = res.pagination?.page ?? Number(filters.page || 1);
      const limit = res.pagination?.limit ?? Number(filters.limit || 25);
      const totalPages = res.pagination?.totalPages ?? (Math.ceil(total / limit) || 1);

      return {
        items: res.data,
        total,
        page,
        pageSize: limit,
        totalPages,
      };
    }

    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    };
  }

  /**
   * Fetches single customer by ID with full order history and addresses.
   */
  public async fetchCustomerById(id: string): Promise<CustomerDetail> {
    const res = await apiClient.get<BackendApiResponse<CustomerDetail>>(
      `admin/customers/${encodeURIComponent(id)}`
    );
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.message || 'Failed to fetch customer profile');
  }

  /**
   * Fetches real database metrics on customers.
   */
  public async fetchCustomerAnalytics(): Promise<CustomerAnalytics> {
    const res = await apiClient.get<BackendApiResponse<CustomerAnalytics>>(
      'admin/customers/analytics'
    );
    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.message || 'Failed to fetch customer analytics');
  }

  /**
   * Activates or suspends a customer account.
   */
  public async updateCustomerStatus(
    id: string,
    isActive: boolean,
    reason?: string
  ): Promise<{ id: string; isActive: boolean; updatedAt: string }> {
    const res = await apiClient.patch<
      BackendApiResponse<{ id: string; isActive: boolean; updatedAt: string }>
    >(`admin/customers/${encodeURIComponent(id)}/status`, {
      isActive,
      reason,
    });

    if (res.success && res.data) {
      return res.data;
    }
    throw new Error(res.message || 'Failed to update customer status');
  }

  /**
   * Streams customers export directly as CSV or XLSX.
   */
  public async exportCustomers(
    format: 'csv' | 'xlsx' = 'xlsx',
    filters: CustomerQueryFilters = {},
    selectedIds?: string[]
  ): Promise<Blob> {
    const params: Record<string, string | number | boolean | undefined> = { format };
    if (selectedIds && selectedIds.length > 0) {
      params.selectedIds = selectedIds.join(',');
    } else {
      if (filters.search) params.search = filters.search;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.hasOrders && filters.hasOrders !== 'all') params.hasOrders = filters.hasOrders;
      if (filters.district) params.district = filters.district;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('dsl_admin_token') : null;
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();

    const response = await fetch(`http://localhost:4000/api/v1/admin/customers/export?${queryString}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}: ${response.statusText}`);
    }

    return await response.blob();
  }
}

export const customerService = new CustomerService();
