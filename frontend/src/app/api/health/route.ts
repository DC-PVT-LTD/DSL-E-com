import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backendBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
  const targetUrl = `${backendBase}/health`;

  try {
    const res = await fetch(targetUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const backendHealth = await res.json();
      return NextResponse.json({
        status: 'healthy',
        service: 'dsl-stationery-frontend',
        backend: backendHealth,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        status: 'degraded',
        service: 'dsl-stationery-frontend',
        backend: {
          status: 'unhealthy',
          statusCode: res.status,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'degraded',
        service: 'dsl-stationery-frontend',
        backend: {
          status: 'unreachable',
          error: error instanceof Error ? error.message : 'Backend unreachable',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
