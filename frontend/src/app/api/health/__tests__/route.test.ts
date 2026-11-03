import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';

describe('Frontend Health Check API Route (/api/health)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns HTTP 200 and healthy status when backend health check succeeds', async () => {
    const mockBackendHealth = {
      status: 'healthy',
      service: 'dsl-stationery-backend',
      database: { status: 'connected', latencyMs: 5 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBackendHealth,
    } as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('dsl-stationery-frontend');
    expect(data.backend.status).toBe('healthy');
    expect(data.backend.database.status).toBe('connected');
  });

  it('returns HTTP 503 and degraded status when backend is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.backend.status).toBe('unreachable');
    expect(data.backend.error).toBe('Connection refused');
  });
});

