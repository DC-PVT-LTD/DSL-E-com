import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrisma: Partial<Record<keyof PrismaService | 'product' | 'category', any>>;

  beforeEach(() => {
    mockPrisma = {
      isHealthy: vi.fn(),
      product: {
        count: vi.fn(),
      },
      category: {
        count: vi.fn(),
      },
    };

    controller = new HealthController(mockPrisma as unknown as PrismaService);
  });

  it('returns status healthy and database connected when DB is reachable', async () => {
    (mockPrisma.isHealthy as any).mockResolvedValue({
      connected: true,
      latencyMs: 12,
    });
    (mockPrisma.product.count as any).mockResolvedValue(8);
    (mockPrisma.category.count as any).mockResolvedValue(15);

    const result = await controller.checkHealth();

    expect(result.status).toBe('healthy');
    expect(result.service).toBe('dsl-stationery-backend');
    expect(result.database.status).toBe('connected');
    expect(result.database.latencyMs).toBe(12);
    expect(result.database.counts.products).toBe(8);
    expect(result.database.counts.categories).toBe(15);
  });

  it('throws ServiceUnavailableException when database ping fails', async () => {
    (mockPrisma.isHealthy as any).mockResolvedValue({
      connected: false,
      error: 'Connection refused',
    });

    await expect(controller.checkHealth()).rejects.toThrow(ServiceUnavailableException);

    try {
      await controller.checkHealth();
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const res = (err as ServiceUnavailableException).getResponse() as any;
      expect(res.status).toBe('degraded');
      expect(res.database.status).toBe('disconnected');
      expect(res.database.error).toBe('Connection refused');
    }
  });

  it('throws ServiceUnavailableException when table counting fails', async () => {
    (mockPrisma.isHealthy as any).mockResolvedValue({
      connected: true,
      latencyMs: 5,
    });
    (mockPrisma.product.count as any).mockRejectedValue(new Error('Table lock timeout'));

    await expect(controller.checkHealth()).rejects.toThrow(ServiceUnavailableException);

    try {
      await controller.checkHealth();
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const res = (err as ServiceUnavailableException).getResponse() as any;
      expect(res.status).toBe('degraded');
      expect(res.database.status).toBe('disconnected');
      expect(res.database.error).toBe('Table lock timeout');
    }
  });
});
