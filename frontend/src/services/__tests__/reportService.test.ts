import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportService } from '../reportService';
import { apiClient } from '@/lib/api/apiClient';

describe('reportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchReportSummary', () => {
    it('calls GET admin/reports/summary with correct parameters and returns data', async () => {
      const mockData = {
        period: 'last30days',
        dateFrom: '2026-10-17',
        dateTo: '2026-11-15',
        timezone: 'Asia/Colombo',
        kpi: {
          grossSalesCents: 500000,
          netRevenueCents: 500000,
          totalRefundsCents: 0,
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: mockData,
      } as any);

      const result = await reportService.fetchReportSummary({ period: 'last30days' });

      expect(getSpy).toHaveBeenCalledWith('admin/reports/summary', {
        params: {
          period: 'last30days',
          dateFrom: undefined,
          dateTo: undefined,
        },
      });
      expect(result).toEqual(mockData);
    });

    it('throws error if response is unsuccessful', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: false,
        message: 'Unauthorized access',
      } as any);

      await expect(reportService.fetchReportSummary()).rejects.toThrow('Unauthorized access');
    });
  });

  describe('fetchSalesReport', () => {
    it('calls GET admin/reports/sales with custom date range', async () => {
      const mockData = {
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
        timezone: 'Asia/Colombo',
        kpi: { grossSalesCents: 1000000 },
        dailySales: [
          {
            date: '2026-11-01',
            grossSalesCents: 500000,
            netRevenueCents: 500000,
          },
        ],
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: mockData,
      } as any);

      const result = await reportService.fetchSalesReport({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(getSpy).toHaveBeenCalledWith('admin/reports/sales', {
        params: {
          period: 'custom',
          dateFrom: '2026-11-01',
          dateTo: '2026-11-15',
        },
      });
      expect(result.dailySales.length).toBe(1);
    });
  });

  describe('exportReport', () => {
    it('builds export URL and retrieves file blob with headers', async () => {
      const mockBlob = new Blob(['sample-content'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      vi.spyOn(apiClient, 'buildUrl').mockReturnValue(
        'http://localhost:4000/api/v1/admin/reports/export?period=last30days&format=xlsx'
      );

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          'content-disposition': 'attachment; filename="dsl-sales-report-last30days.xlsx"',
        }),
        blob: vi.fn().mockResolvedValue(mockBlob),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await reportService.exportReport({ period: 'last30days' }, 'xlsx');

      expect(result.blob).toBe(mockBlob);
      expect(result.filename).toBe('dsl-sales-report-last30days.xlsx');
    });

    it('throws error if server returns non-ok status', async () => {
      vi.spyOn(apiClient, 'buildUrl').mockReturnValue(
        'http://localhost:4000/api/v1/admin/reports/export?format=xlsx'
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(reportService.exportReport({}, 'xlsx')).rejects.toThrow(
        'Report export failed with status 403: Forbidden'
      );
    });
  });

  describe('downloadReportFile', () => {
    it('creates object URL and simulates anchor download', async () => {
      const mockBlob = new Blob(['test-xlsx']);
      vi.spyOn(reportService, 'exportReport').mockResolvedValueOnce({
        blob: mockBlob,
        filename: 'report.xlsx',
      });

      const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/test');
      const revokeObjectURLMock = vi.fn();
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;

      const realAnchor = document.createElement('a');
      const clickSpy = vi.spyOn(realAnchor, 'click').mockImplementation(() => {});
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(realAnchor);

      const filename = await reportService.downloadReportFile({ period: 'last30days' }, 'xlsx');

      expect(filename).toBe('report.xlsx');
      expect(createObjectURLMock).toHaveBeenCalledWith(mockBlob);
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/test');
      createElementSpy.mockRestore();
    });
  });
});

