import { Controller, Get, ServiceUnavailableException, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'System health check',
    description: 'Checks backend process uptime and live PostgreSQL database connectivity and latency.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service and database are operational and healthy',
    schema: {
      example: {
        status: 'healthy',
        service: 'dsl-stationery-backend',
        timestamp: '2026-11-03T11:00:00.000Z',
        uptime: 120.45,
        database: {
          status: 'connected',
          latencyMs: 3.2,
          counts: {
            products: 8,
            categories: 15,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Database is unreachable or degraded',
  })
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
