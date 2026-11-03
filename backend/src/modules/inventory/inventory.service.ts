import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import {
  InventoryMovementQueryDto,
  LowStockQueryDto,
} from './dto/inventory-query.dto';
import {
  toPrismaPagination,
  createPaginationMeta,
} from '../../common/pagination/pagination.util';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../common/interfaces/api-response.interface';
import { excludeSensitiveFields } from '../../common/utils/serialization.util';

export interface StockAdjustmentResult {
  movement: {
    id: string;
    productId: string;
    variantId: string | null;
    previousQuantity: number;
    newQuantity: number;
    changeAmount: number;
    reason: string;
    note: string | null;
    performedById: string | null;
    createdAt: Date;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
    lowStockThreshold: number;
  };
  variant: {
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
  } | null;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Atomically adjusts stock for a product or product variant within a PostgreSQL transaction.
   * Uses row-level pessimistic locking (SELECT ... FOR UPDATE) to eliminate concurrent overselling.
   */
  async adjustStock(
    dto: AdjustInventoryDto,
    actor: { id: string; email?: string; name?: string }
  ): Promise<StockAdjustmentResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock and fetch parent Product with pessimistic row lock
      const lockedProducts = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          sku: string;
          stockQuantity: number;
          lowStockThreshold: number;
          isActive: boolean;
        }>
      >`
        SELECT id, name, sku, "stockQuantity", "lowStockThreshold", "isActive"
        FROM "Product"
        WHERE id = ${dto.productId}
        FOR UPDATE
      `;

      if (!lockedProducts || lockedProducts.length === 0) {
        throw new NotFoundException(`Product with ID "${dto.productId}" not found`);
      }
      const product = lockedProducts[0];

      // 2. If variant specified, lock and fetch ProductVariant
      let variant: {
        id: string;
        productId: string;
        name: string;
        sku: string;
        stockQuantity: number;
        isActive: boolean;
      } | null = null;

      if (dto.variantId) {
        const lockedVariants = await tx.$queryRaw<
          Array<{
            id: string;
            productId: string;
            name: string;
            sku: string;
            stockQuantity: number;
            isActive: boolean;
          }>
        >`
          SELECT id, "productId", name, sku, "stockQuantity", "isActive"
          FROM "ProductVariant"
          WHERE id = ${dto.variantId}
          FOR UPDATE
        `;

        if (!lockedVariants || lockedVariants.length === 0) {
          throw new NotFoundException(`Product variant with ID "${dto.variantId}" not found`);
        }

        variant = lockedVariants[0];
        if (variant.productId !== dto.productId) {
          throw new BadRequestException(
            `Variant "${dto.variantId}" does not belong to product "${dto.productId}"`
          );
        }
      }

      // 3. Determine base previous quantity & calculate signed delta
      const previousQuantity = variant ? variant.stockQuantity : product.stockQuantity;

      let changeAmount: number;
      if (dto.delta !== undefined) {
        changeAmount = dto.delta;
      } else if (dto.targetQuantity !== undefined) {
        changeAmount = dto.targetQuantity - previousQuantity;
      } else {
        throw new BadRequestException('Either delta or targetQuantity must be provided');
      }

      if (changeAmount === 0) {
        throw new BadRequestException(
          'Target quantity matches current stock; adjustment delta cannot be 0'
        );
      }

      const newQuantity = previousQuantity + changeAmount;
      if (newQuantity < 0) {
        throw new BadRequestException(
          `Stock adjustment would result in negative stock: current ${previousQuantity}, requested change ${changeAmount}`
        );
      }

      // If adjusting a variant, also ensure the parent product aggregate does not go below zero
      if (variant) {
        const newParentStock = product.stockQuantity + changeAmount;
        if (newParentStock < 0) {
          throw new BadRequestException(
            `Parent product aggregate stock would become negative: current ${product.stockQuantity}, requested change ${changeAmount}`
          );
        }
      }

      // 4. Update stock atomically
      let updatedVariant: {
        id: string;
        name: string;
        sku: string;
        stockQuantity: number;
      } | null = null;

      if (variant) {
        updatedVariant = await tx.productVariant.update({
          where: { id: variant.id },
          data: { stockQuantity: { increment: changeAmount } },
          select: { id: true, name: true, sku: true, stockQuantity: true },
        });

        // Keep parent product stock in lockstep with variant changes to represent aggregate available stock
        const updatedProduct = await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: { increment: changeAmount } },
          select: { id: true, name: true, sku: true, stockQuantity: true, lowStockThreshold: true },
        });

        const movement = await tx.inventoryMovement.create({
          data: {
            productId: dto.productId,
            variantId: dto.variantId || null,
            previousQuantity,
            newQuantity,
            changeAmount,
            reason: dto.reason,
            note: dto.note || null,
            performedById: actor.id,
          },
        });

        this.logger.log(
          `Stock adjusted for variant "${variant.sku}" of product "${product.sku}": ` +
          `previous=${previousQuantity}, delta=${changeAmount}, new=${newQuantity}, by=${actor.id}`
        );

        return {
          movement,
          product: updatedProduct,
          variant: updatedVariant,
        };
      }

      // Standalone product update
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: { increment: changeAmount } },
        select: { id: true, name: true, sku: true, stockQuantity: true, lowStockThreshold: true },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          variantId: null,
          previousQuantity,
          newQuantity,
          changeAmount,
          reason: dto.reason,
          note: dto.note || null,
          performedById: actor.id,
        },
      });

      this.logger.log(
        `Stock adjusted for product "${product.sku}": ` +
        `previous=${previousQuantity}, delta=${changeAmount}, new=${newQuantity}, by=${actor.id}`
      );

      return {
        movement,
        product: updatedProduct,
        variant: null,
      };
    });
  }

  /**
   * Retrieves paginated inventory movement history with optional product, variant, reason, and date filters.
   */
  async getMovements(query: InventoryMovementQueryDto): Promise<PaginatedResponse<any>> {
    const where: Prisma.InventoryMovementWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.variantId) {
      where.variantId = query.variantId;
    }
    if (query.reason) {
      where.reason = query.reason;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        if (!isNaN(start.getTime())) {
          where.createdAt.gte = start;
        }
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (!isNaN(end.getTime())) {
          // If YYYY-MM-DD format, extend to end-of-day
          if (query.endDate.length <= 10) {
            end.setHours(23, 59, 59, 999);
          }
          where.createdAt.lte = end;
        }
      }
    }

    const { skip, take, orderBy } = toPrismaPagination(query);

    const [totalItems, movements] = await Promise.all([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      }),
    ]);

    const meta = createPaginationMeta(totalItems, query.page, query.limit);
    return createPaginatedResponse(movements, meta);
  }

  /**
   * Retrieves products whose stock is at or below their configured lowStockThreshold
   * (or a custom threshold cutoff) using a safe parameterized SQL query at the database level.
   */
  async getLowStock(query: LowStockQueryDto): Promise<PaginatedResponse<any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const whereConditions: Prisma.Sql[] = [Prisma.sql`p."isActive" = true`];

    if (query.threshold !== undefined) {
      whereConditions.push(Prisma.sql`p."stockQuantity" <= ${query.threshold}`);
    } else {
      whereConditions.push(Prisma.sql`p."stockQuantity" <= p."lowStockThreshold"`);
    }

    if (query.categoryId) {
      whereConditions.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    }

    const whereSql = Prisma.join(whereConditions, ' AND ');

    const [totalCountResult, idRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Product" p
        WHERE ${whereSql}
      `,
      this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT p.id
        FROM "Product" p
        WHERE ${whereSql}
        ORDER BY p."stockQuantity" ASC, p."name" ASC
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const totalItems = Number(totalCountResult[0]?.count || 0);
    const meta = createPaginationMeta(totalItems, page, limit);

    if (idRows.length === 0) {
      return createPaginatedResponse([], meta);
    }

    const productIds = idRows.map((r) => r.id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
            isActive: true,
          },
        },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const sortedProducts = productIds
      .map((id) => productMap.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((prod) => excludeSensitiveFields(prod, ['costPriceCents']));

    return createPaginatedResponse(sortedProducts, meta);
  }
}

