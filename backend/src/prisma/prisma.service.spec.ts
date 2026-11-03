import 'dotenv/config';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('throws an error if DATABASE_URL is not configured', () => {
    const mockConfig = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new PrismaService(mockConfig)).toThrow(
      'DATABASE_URL environment variable is not defined.'
    );
  });

  describe('unit tests with mocked internals', () => {
    let service: PrismaService;
    let mockConfig: ConfigService;

    beforeEach(() => {
      mockConfig = {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'DATABASE_URL') return 'postgresql://mock:mock@localhost:5432/mock_db';
          return undefined;
        }),
      } as unknown as ConfigService;

      service = new PrismaService(mockConfig);
    });

    afterEach(async () => {
      vi.restoreAllMocks();
    });

    it('instantiates successfully with configured DATABASE_URL', () => {
      expect(service).toBeDefined();
      expect(typeof service.isHealthy).toBe('function');
      expect(typeof service.onModuleInit).toBe('function');
      expect(typeof service.onModuleDestroy).toBe('function');
    });

    it('returns healthy status when $queryRaw succeeds', async () => {
      vi.spyOn(service as any, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);

      const health = await service.isHealthy();
      expect(health.connected).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();
    });

    it('returns disconnected and error message when $queryRaw fails', async () => {
      vi.spyOn(service as any, '$queryRaw').mockRejectedValue(new Error('Connection terminated'));

      const health = await service.isHealthy();
      expect(health.connected).toBe(false);
      expect(health.error).toBe('Connection terminated');
      expect(health.latencyMs).toBeUndefined();
    });

    it('calls $connect during onModuleInit', async () => {
      const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(connectSpy).toHaveBeenCalled();
    });

    it('calls $disconnect and ends pool during onModuleDestroy', async () => {
      const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined);
      const poolEndSpy = vi.spyOn((service as any).pool, 'end').mockResolvedValue(undefined);

      await service.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalled();
      expect(poolEndSpy).toHaveBeenCalled();
    });
  });

  describe('live integration test against dsl_stationery database', () => {
    const dbUrl = process.env.DATABASE_URL;

    it.skipIf(!dbUrl)('successfully connects and queries live database', async () => {
      const liveConfig = {
        get: vi.fn().mockReturnValue(dbUrl),
      } as unknown as ConfigService;

      const liveService = new PrismaService(liveConfig);
      await liveService.onModuleInit();

      const health = await liveService.isHealthy();
      expect(health.connected).toBe(true);
      expect(health.latencyMs).toBeDefined();

      const productCount = await liveService.product.count();
      expect(productCount).toBeGreaterThanOrEqual(0);

      await liveService.onModuleDestroy();
    });
  });
});
