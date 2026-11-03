import { Controller, Get, ServiceUnavailableException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    const dbHealth = await this.prisma.isHealthy();

    let productCount = 0;
    let categoryCount = 0;

    if (dbHealth.connected) {
      try {
        [productCount, categoryCount] = await Promise.all([
          this.prisma.product.count(),
          this.prisma.category.count(),
        ]);
      } catch (err) {
        dbHealth.connected = false;
        dbHealth.error = err instanceof Error ? err.message : 'Failed to query table counts';
      }
    }

    const response = {
      status: dbHealth.connected ? 'healthy' : 'degraded',
      service: 'dsl-stationery-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbHealth.connected ? 'connected' : 'disconnected',
        ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
        counts: {
          products: productCount,
          categories: categoryCount,
        },
      },
    };

    if (!dbHealth.connected) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
