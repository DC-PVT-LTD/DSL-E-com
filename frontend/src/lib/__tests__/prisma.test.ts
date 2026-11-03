import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../prisma';

describe('Prisma Client Integration', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('provides a functional singleton instance', () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe('function');
    expect(typeof prisma.$queryRaw).toBe('function');
    expect(prisma.product).toBeDefined();
    expect(prisma.category).toBeDefined();
    expect(prisma.order).toBeDefined();
  });

  it('successfully executes a harmless read-only query against PostgreSQL', async () => {
    // 1. Raw database ping query
    const rawResult = await prisma.$queryRaw<Array<{ ping: number }>>`SELECT 1 as ping`;
    expect(rawResult).toHaveLength(1);
    expect(rawResult[0].ping).toBe(1);

    // 2. Harmless count query on product table
    const productCount = await prisma.product.count();
    expect(typeof productCount).toBe('number');
    expect(productCount).toBeGreaterThanOrEqual(0);

    // 3. Harmless count query on category table
    const categoryCount = await prisma.category.count();
    expect(typeof categoryCount).toBe('number');
    expect(categoryCount).toBeGreaterThanOrEqual(0);
  });
});
