import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Response } from 'express';

describe('ReportsController — Controller Unit Tests', () => {
  let controller: ReportsController;
  let mockReportsService: any;

  beforeEach(() => {
    mockReportsService = {
      getSummary: vi.fn().mockResolvedValue({
        period: 'last30days',
        dateFrom: '2026-10-17',
        dateTo: '2026-11-15',
        kpi: { grossSalesCents: 500000 },
      }),
      getSalesReport: vi.fn().mockResolvedValue({
        period: 'last30days',
        dateFrom: '2026-10-17',
        dateTo: '2026-11-15',
        dailySales: [],
      }),
      exportReport: vi.fn().mockResolvedValue({
        buffer: Buffer.from('test-content'),
        filename: 'report.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    };

    controller = new ReportsController(mockReportsService as ReportsService);
  });

  it('delegates getSummary to ReportsService', async () => {
    const res = await controller.getSummary({ period: 'last30days' });
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(mockReportsService.getSummary).toHaveBeenCalledWith({ period: 'last30days' });
  });

  it('delegates getSalesReport to ReportsService', async () => {
    const res = await controller.getSalesReport({ period: 'last30days' });
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(mockReportsService.getSalesReport).toHaveBeenCalledWith({ period: 'last30days' });
  });

  it('delegates exportReport to ReportsService with response streaming', async () => {
    const mockRes = {
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as Response;

    await controller.exportReport({ period: 'last30days', format: 'xlsx' }, mockRes);

    expect(mockReportsService.exportReport).toHaveBeenCalledWith(
      { period: 'last30days', format: 'xlsx' },
      'xlsx',
      mockRes
    );
  });
});

