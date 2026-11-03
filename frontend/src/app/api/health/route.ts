import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Perform harmless read-only query to verify connection
    const healthResult = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
    const productCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      querySuccessful: healthResult.length > 0 && healthResult[0].result === 1,
      stats: {
        products: productCount,
        categories: categoryCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Prisma health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Database query failed',
      },
      { status: 500 }
    );
  }
}
