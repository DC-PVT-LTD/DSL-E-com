import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export function extractCode(slugOrName: string, fallback: string = 'GEN'): string {
  if (!slugOrName) return fallback;
  const clean = slugOrName.toLowerCase().replace(/[^a-z0-9\s-]/g, '');
  const words = clean.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return fallback;

  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  }

  if (words.length === 2) {
    const w0Consonants = words[0].slice(1).replace(/[aeiou]/g, '');
    const middleChar = w0Consonants[0] || words[0][1] || words[1][0];
    const candidate = (words[0][0] + middleChar + words[1][0]).toUpperCase();
    if (candidate.length === 3) return candidate;
  }

  const single = words[0];
  const firstChar = single[0];
  const remainingConsonants = single.slice(1).replace(/[aeiou]/g, '');
  if (remainingConsonants.length >= 2) {
    return (firstChar + remainingConsonants[0] + remainingConsonants[1]).toUpperCase();
  }

  const candidate = single.slice(0, 3).toUpperCase();
  return candidate.padEnd(3, 'X');
}

export function extractColorCode(colorName: string): string {
  if (!colorName) return 'VAR';
  const clean = colorName.trim().toUpperCase();
  const knownColors: Record<string, string> = {
    BLUE: 'BLU',
    RED: 'RED',
    BLACK: 'BLK',
    GREEN: 'GRN',
    YELLOW: 'YEL',
    ORANGE: 'ORG',
    PURPLE: 'PUR',
    PINK: 'PNK',
    WHITE: 'WHT',
    GREY: 'GRY',
    GRAY: 'GRY',
    BROWN: 'BRN',
    GOLD: 'GLD',
    SILVER: 'SLV',
  };
  if (knownColors[clean]) return knownColors[clean];
  return extractCode(clean, 'VAR');
}

@Injectable()
export class SkuGeneratorService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getCategoryCode(slugOrName: string): string {
    return extractCode(slugOrName, 'CAT');
  }

  getBrandCode(slugOrName: string): string {
    return extractCode(slugOrName, 'BRD');
  }

  getColorCode(colorName: string): string {
    return extractColorCode(colorName);
  }

  async getNextSequence(tx: any, prefix: string): Promise<number> {
    const client = tx || this.prisma;
    const result = await client.$queryRawUnsafe(
      `
      INSERT INTO "SkuSequence" (prefix, "lastSequence", "updatedAt")
      VALUES ($1, 1, NOW())
      ON CONFLICT (prefix)
      DO UPDATE SET "lastSequence" = "SkuSequence"."lastSequence" + 1, "updatedAt" = NOW()
      RETURNING "lastSequence"
      `,
      prefix
    );
    return result[0].lastSequence;
  }

  async previewProductSku(
    categoryId: string,
    brandId: string
  ): Promise<string> {
    const [category, brand] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: categoryId } }),
      this.prisma.brand.findUnique({ where: { id: brandId } }),
    ]);

    if (!category) {
      throw new NotFoundException(`Category "${categoryId}" not found`);
    }
    if (!brand) {
      throw new NotFoundException(`Brand "${brandId}" not found`);
    }

    const catCode = this.getCategoryCode(category.slug || category.name);
    const brdCode = this.getBrandCode(brand.slug || brand.name);
    const prefix = `DSL-${catCode}-${brdCode}`;

    const seqRow = await this.prisma.skuSequence.findUnique({
      where: { prefix },
    });

    let currentSeq = (seqRow?.lastSequence || 0) + 1;
    let attempts = 0;
    while (attempts < 100) {
      const candidate = `${prefix}-${String(currentSeq).padStart(5, '0')}`;
      const existing = await this.prisma.globalSku.findUnique({
        where: { sku: candidate },
      });
      if (!existing) {
        return candidate;
      }
      currentSeq++;
      attempts++;
    }

    return `${prefix}-${String(currentSeq).padStart(5, '0')}`;
  }

  async syncSequenceIfHigher(sku: string, tx?: any): Promise<void> {
    if (!sku) return;
    const match = sku.match(/^DSL-([A-Z0-9]{3})-([A-Z0-9]{3})-(\d{5})$/);
    if (!match) return;
    const prefix = `DSL-${match[1]}-${match[2]}`;
    const seq = parseInt(match[3], 10);
    const client = tx || this.prisma;
    await client.$queryRawUnsafe(
      `
      INSERT INTO "SkuSequence" (prefix, "lastSequence", "updatedAt")
      VALUES ($1, $2, NOW())
      ON CONFLICT (prefix)
      DO UPDATE SET "lastSequence" = GREATEST("SkuSequence"."lastSequence", $2), "updatedAt" = NOW()
      `,
      prefix,
      seq
    );
  }

  async generateProductSku(
    categoryId: string,
    brandId: string,
    tx?: any
  ): Promise<string> {
    const client = tx || this.prisma;

    const [category, brand] = await Promise.all([
      client.category.findUnique({ where: { id: categoryId } }),
      client.brand.findUnique({ where: { id: brandId } }),
    ]);

    if (!category) {
      throw new NotFoundException(`Category "${categoryId}" not found`);
    }
    if (!brand) {
      throw new NotFoundException(`Brand "${brandId}" not found`);
    }

    const catCode = this.getCategoryCode(category.slug || category.name);
    const brdCode = this.getBrandCode(brand.slug || brand.name);
    const prefix = `DSL-${catCode}-${brdCode}`;

    let attempts = 0;
    while (attempts < 100) {
      const seq = await this.getNextSequence(client, prefix);
      const candidate = `${prefix}-${String(seq).padStart(5, '0')}`;

      const existing = await client.globalSku.findUnique({
        where: { sku: candidate },
      });

      if (!existing) {
        return candidate;
      }
      attempts++;
    }

    throw new ConflictException(
      `Failed to allocate a unique product SKU for prefix "${prefix}" after 100 attempts.`
    );
  }

  async generateVariantSku(
    parentProductIdOrSku: string,
    options?: { color?: string; index?: number },
    tx?: any
  ): Promise<string> {
    const client = tx || this.prisma;

    let parentSku = parentProductIdOrSku;
    if (!parentSku.startsWith('DSL-')) {
      const product = await client.product.findUnique({
        where: { id: parentProductIdOrSku },
        select: { sku: true },
      });
      if (product) {
        parentSku = product.sku;
      }
    }

    if (options?.color) {
      const colorCode = this.getColorCode(options.color);
      const colorCandidate = `${parentSku}-${colorCode}`;
      const existing = await client.globalSku.findUnique({
        where: { sku: colorCandidate },
      });
      if (!existing) {
        return colorCandidate;
      }
    }

    let idx = options?.index ?? 1;
    let attempts = 0;
    while (attempts < 100) {
      const candidate = `${parentSku}-V${String(idx).padStart(2, '0')}`;
      const existing = await client.globalSku.findUnique({
        where: { sku: candidate },
      });
      if (!existing) {
        return candidate;
      }
      idx++;
      attempts++;
    }

    throw new ConflictException(
      `Failed to allocate a unique variant SKU for parent "${parentSku}" after 100 attempts.`
    );
  }
}
