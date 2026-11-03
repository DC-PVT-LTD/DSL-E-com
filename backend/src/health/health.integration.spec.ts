import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('API Integration Test (HTTP Level)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());

    app.enableCors({
      origin: ['http://localhost:3000', 'http://localhost:3002'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address !== null ? address.port : 4000;
    baseUrl = `http://localhost:${port}/api/v1`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/health returns HTTP 200 and database connectivity status', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('dsl-stationery-backend');
    expect(data.database).toBeDefined();
    expect(data.database.status).toBe('connected');
    expect(typeof data.database.latencyMs).toBe('number');
    expect(data.database.counts.products).toBeGreaterThanOrEqual(0);
    expect(data.database.counts.categories).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/non-existent returns HTTP 404 formatted by HttpExceptionFilter', async () => {
    const response = await fetch(`${baseUrl}/non-existent`);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.statusCode).toBe(404);
    expect(data.error).toBe('NOT_FOUND');
    expect(data.message).toContain('Cannot GET');
    expect(data.timestamp).toBeDefined();
    expect(data.path).toBe('/api/v1/non-existent');
  });

  it('OPTIONS /api/v1/health responds with expected CORS headers for allowed frontend origin', async () => {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3002',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3002');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
