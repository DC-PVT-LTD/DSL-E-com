import {
  ReportSummaryResponse,
  SalesReportResponse,
  ReportQueryFilters,
  ExportFormat,
} from '@/types/report';
import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';

class ReportService {
  /**
   * Fetches summary metrics, financial reconciliation, and KPI distributions.
   */
  public async fetchReportSummary(
    filters: ReportQueryFilters = {}
  ): Promise<ReportSummaryResponse> {
    const params: Record<string, string | number | boolean | undefined> = {
      period: filters.period || 'last30days',
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    };

    const res = await apiClient.get<BackendApiResponse<ReportSummaryResponse>>(
      'admin/reports/summary',
      { params }
    );

    if (res && res.success && res.data) {
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch reporting summary');
  }

  /**
   * Fetches full sales report including daily trend buckets and recent orders.
   */
  public async fetchSalesReport(
    filters: ReportQueryFilters = {}
  ): Promise<SalesReportResponse> {
    const params: Record<string, string | number | boolean | undefined> = {
      period: filters.period || 'last30days',
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    };

    const res = await apiClient.get<BackendApiResponse<SalesReportResponse>>(
      'admin/reports/sales',
      { params }
    );

    if (res && res.success && res.data) {
      return res.data;
    }
    throw new Error(res?.message || 'Failed to fetch detailed sales report');
  }

  /**
   * Streams report export blob (XLSX or CSV) from the authoritative backend endpoint.
   */
  public async exportReport(
    filters: ReportQueryFilters = {},
    format: ExportFormat = 'xlsx'
  ): Promise<{ blob: Blob; filename: string }> {
    const params: Record<string, string | number | boolean | undefined> = {
      period: filters.period || 'last30days',
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      format,
    };

    const exportUrl = apiClient.buildUrl('admin/reports/export', params);

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('dsl_admin_token') || localStorage.getItem('dsl_access_token')
        : null;

    const response = await fetch(exportUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Report export failed with status ${response.status}: ${response.statusText}`);
    }

    // Try to extract filename from Content-Disposition header
    let filename = `dsl-sales-report-${filters.period || 'report'}.${format}`;
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (matches && matches[1]) {
        filename = matches[1].replace(/['"]/g, '').trim();
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  }

  /**
   * Downloads the exported report file directly in browser.
   */
  public async downloadReportFile(
    filters: ReportQueryFilters = {},
    format: ExportFormat = 'xlsx'
  ): Promise<string> {
    const { blob, filename } = await this.exportReport(filters, format);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
    return filename;
  }
}

export const reportService = new ReportService();

