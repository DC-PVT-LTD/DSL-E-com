import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
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
import { InventoryGateway } from './inventory.gateway';
import { BackInStockService } from '../back-in-stock/back-in-stock.service';

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

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(InventoryGateway) private readonly inventoryGateway?: InventoryGateway,
    @Optional() @Inject(BackInStockService) private readonly backInStockService?: BackInStockService
  ) {}

  /**
   * Atomically adjusts stock for a product or product variant within a PostgreSQL transaction.
   * Uses row-level pessimistic locking (SELECT ... FOR UPDATE) to eliminate concurrent overselling.
   */
  async adjustStock(
    dto: AdjustInventoryDto,
    actor: { id: string; email?: string; name?: string }
  ): Promise<StockAdjustmentResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      return this.adjustStockWithTx(tx, dto, actor);
    });

    // Invariant: broadcast committed update strictly after transaction commits
    try {
      if (this.inventoryGateway) {
        const activeRes = this.prisma.stockReservationItem
          ? await this.prisma.stockReservationItem.findMany({
              where: {
                productId: result.product.id,
                ...(result.variant ? { variantId: result.variant.id } : {}),
                reservation: {
                  status: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
                  expiresAt: { gt: new Date() },
                },
              },
              select: { quantity: true },
            })
          : [];
        const currentReserved = activeRes.reduce((s, it) => s + it.quantity, 0);
        const physStock = result.variant
          ? result.variant.stockQuantity
          : result.product.stockQuantity;

        this.inventoryGateway.broadcastStockUpdate({
          productId: result.product.id,
          variantId: result.variant?.id || null,
          physicalStock: physStock,
          reservedStock: currentReserved,
          availableStock: Math.max(0, physStock - currentReserved),
          timestamp: new Date().toISOString(),
          reason: dto.reason,
        });
      }
    } catch (wsErr) {
      this.logger.warn('Failed to broadcast inventory update:', wsErr);
    }

    // Phase 15.4: Automatic back-in-stock alerts trigger on 0 -> positive stock transition
    const previousStock = result.movement.previousQuantity;
    const newStock = result.movement.newQuantity;

    if (previousStock === 0 && newStock > 0 && this.backInStockService) {
      this.logger.log(
        `Authoritative stock transition (0 -> ${newStock}) detected for product ${result.product.id}. Processing back-in-stock alerts.`
      );
      try {
        await this.backInStockService.processStockRestocked(result.product.id);
      } catch (alertErr) {
        this.logger.error('Failed to process back-in-stock alerts:', alertErr);
      }
    }

    return result;
  }

  /**
   * Transaction-safe stock adjustment callable within an overarching interactive chunk transaction.
   * Enforces pessimistic locking, reservation checks, variant/parent aggregate sync, and movement tracking.
   */
  async adjustStockWithTx(
    tx: Prisma.TransactionClient,
    dto: AdjustInventoryDto,
    actor: { id: string; email?: string; name?: string }
  ): Promise<StockAdjustmentResult> {
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

    // Enforce fundamental invariant: Physical Stock >= Active Reserved Stock
    const activeReservations = tx.stockReservationItem
      ? await tx.stockReservationItem.findMany({
          where: {
            productId: dto.productId,
            ...(dto.variantId ? { variantId: dto.variantId } : {}),
            reservation: {
              status: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
              expiresAt: { gt: new Date() },
            },
          },
          select: { quantity: true },
        })
      : [];
    const reservedStock = activeReservations.reduce((sum, item) => sum + item.quantity, 0);

    if (newQuantity < reservedStock) {
      throw new BadRequestException(
        `Cannot reduce physical stock to ${newQuantity}: ${reservedStock} units are currently reserved by customer checkout sessions. Physical stock cannot fall below active reservations.`
      );
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
  }

  /**
   * Retrieves real-time stock breakdown: physical, reserved, and available stock.
   */
  async getLiveStockStatus(productId: string, variantId?: string | null): Promise<{
    productId: string;
    variantId: string | null;
    physicalStock: number;
    reservedStock: number;
    availableStock: number;
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException(`Product "${productId}" not found`);

    let physicalStock = product.stockQuantity;
    if (variantId) {
      const v = product.variants.find((item) => item.id === variantId);
      if (!v) throw new NotFoundException(`Variant "${variantId}" not found`);
      physicalStock = v.stockQuantity;
    }

    const activeReservations = await this.prisma.stockReservationItem.findMany({
      where: {
        productId,
        ...(variantId ? { variantId } : {}),
        reservation: {
          status: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
          expiresAt: { gt: new Date() },
        },
      },
      select: { quantity: true },
    });
    const reservedStock = activeReservations.reduce((sum, item) => sum + item.quantity, 0);
    const availableStock = Math.max(0, physicalStock - reservedStock);

    return {
      productId,
      variantId: variantId || null,
      physicalStock,
      reservedStock,
      availableStock,
    };
  }

  /**
   * Batch retrieves live inventory breakdown for a list of product IDs.
   */
  async getBatchLiveStockStatus(productIds: string[]): Promise<
    Record<string, { physicalStock: number; reservedStock: number; availableStock: number }>
  > {
    if (!productIds || productIds.length === 0) return {};

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, stockQuantity: true },
    });

    const activeReservations = await this.prisma.stockReservationItem.findMany({
      where: {
        productId: { in: productIds },
        reservation: {
          status: { in: ['ACTIVE', 'PAYMENT_PENDING'] },
          expiresAt: { gt: new Date() },
        },
      },
      select: { productId: true, quantity: true },
    });

    const reservedMap: Record<string, number> = {};
    for (const r of activeReservations) {
      reservedMap[r.productId] = (reservedMap[r.productId] || 0) + r.quantity;
    }

    const result: Record<string, { physicalStock: number; reservedStock: number; availableStock: number }> = {};
    for (const p of products) {
      const reserved = reservedMap[p.id] || 0;
      result[p.id] = {
        physicalStock: p.stockQuantity,
        reservedStock: reserved,
        availableStock: Math.max(0, p.stockQuantity - reserved),
      };
    }

    return result;
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

