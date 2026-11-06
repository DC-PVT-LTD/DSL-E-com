import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { CreateReservationDto } from './dto/checkout.dto';
import { ReservationStatus, PaymentAttemptStatus } from '../../generated/prisma';

export interface ReservationResult {
  reservationId: string;
  status: ReservationStatus;
  expiresAt: string;
  expiresInSeconds: number;
  isExpired?: boolean;
  stockAvailable?: boolean;
  message?: string;
  unavailableItems?: Array<{
    productId: string;
    variantId: string | null;
    productName: string;
    requestedQuantity: number;
    availableQuantity: number;
  }>;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
    stockQuantity: number;
  }>;
}

function areReservationItemsIdentical(
  a: Array<{ productId: string; variantId?: string | null; quantity: number }>,
  b: Array<{ productId: string; variantId?: string | null; quantity: number }>
): boolean {
  if (a.length !== b.length) return false;
  const sortFn = (x: { productId: string; variantId?: string | null }) =>
    `${x.productId}_${x.variantId || ''}`;
  const sortedA = [...a].sort((x, y) => sortFn(x).localeCompare(sortFn(y)));
  const sortedB = [...b].sort((x, y) => sortFn(x).localeCompare(sortFn(y)));

  for (let i = 0; i < sortedA.length; i++) {
    if (
      sortedA[i].productId !== sortedB[i].productId ||
      (sortedA[i].variantId || null) !== (sortedB[i].variantId || null) ||
      sortedA[i].quantity !== sortedB[i].quantity
    ) {
      return false;
    }
  }
  return true;
}

@Injectable()
export class ReservationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationsService.name);
  private expiryInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryGateway) private readonly inventoryGateway: InventoryGateway
  ) { }

  onModuleInit() {
    // Run reservation expiry worker every 30 seconds
    this.expiryInterval = setInterval(async () => {
      try {
        await this.releaseExpiredReservations();
      } catch (err) {
        this.logger.error('Error during scheduled reservation expiry run:', err);
      }
    }, 30000);
  }

  onModuleDestroy() {
    if (this.expiryInterval) {
      clearInterval(this.expiryInterval);
      this.expiryInterval = null;
    }
  }

  /**
   * Creates an all-or-nothing 10-minute stock reservation within a PostgreSQL transaction.
   * Employs row-level pessimistic locking sorted by product ID to prevent race conditions and deadlocks.
   */
  async createReservation(
    dto: CreateReservationDto,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<ReservationResult> {
    const lookupSessionId = sessionId || dto.sessionId;

    // 1. Session Persistence & Refresh Check (Phase C):
    // If a reservation already exists for this checkout session (or user) and has the identical items,
    // reuse it without resetting expiresAt or creating duplicate reservations.
    if (lookupSessionId || userId || dto.idempotencyKey) {
      const existing = await this.prisma.stockReservation.findFirst({
        where: {
          OR: [
            ...(dto.idempotencyKey ? [{ idempotencyKey: dto.idempotencyKey }] : []),
            ...(lookupSessionId ? [{ sessionId: lookupSessionId }] : []),
            ...(userId ? [{ userId }] : []),
          ],
          status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING, ReservationStatus.EXPIRED] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, stockQuantity: true, isActive: true } },
              variant: { select: { id: true, name: true, stockQuantity: true, isActive: true } },
            },
          },
        },
      });

      if (existing) {
        const isSameItems = areReservationItemsIdentical(
          existing.items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
          })),
          dto.items
        );

        if (isSameItems) {
          const now = new Date();
          const isActive =
            (existing.status === ReservationStatus.ACTIVE || existing.status === ReservationStatus.PAYMENT_PENDING) &&
            existing.expiresAt > now;

          if (isActive) {
            // TIMER PERSISTENCE: Reusing the same reservation, do NOT reset expiresAt!
            const remainingSeconds = Math.max(
              0,
              Math.floor((existing.expiresAt.getTime() - now.getTime()) / 1000)
            );
            return {
              reservationId: existing.id,
              status: existing.status,
              expiresAt: existing.expiresAt.toISOString(),
              expiresInSeconds: remainingSeconds,
              isExpired: false,
              stockAvailable: true,
              items: existing.items.map((it) => ({
                id: it.id,
                productId: it.productId,
                variantId: it.variantId || null,
                productName: it.product.name,
                variantName: it.variant?.name || null,
                quantity: it.quantity,
                unitPriceCents: it.unitPriceCents,
                totalPriceCents: it.unitPriceCents * it.quantity,
                stockQuantity: it.variant ? it.variant.stockQuantity : it.product.stockQuantity,
              })),
            };
          } else {
            // EXPIRED RESERVATION RECOVERY (Phase C): Check stock for Scenario A or B
            if (existing.status !== ReservationStatus.EXPIRED) {
              await this.prisma.stockReservation.update({
                where: { id: existing.id },
                data: { status: ReservationStatus.EXPIRED },
              });
            }

            const stockCheck = await this.checkExpiredStockForReservation(existing.id);
            return {
              reservationId: existing.id,
              status: ReservationStatus.EXPIRED,
              expiresAt: existing.expiresAt.toISOString(),
              expiresInSeconds: 0,
              isExpired: true,
              stockAvailable: stockCheck.stockAvailable,
              message: stockCheck.message,
              ...(stockCheck.unavailableItems ? { unavailableItems: stockCheck.unavailableItems } : {}),
              items: stockCheck.items,
            };
          }
        } else {
          // If customer changed cart items, release any ACTIVE prior reservation so stock returns to pool
          if (existing.status === ReservationStatus.ACTIVE && existing.expiresAt > new Date()) {
            await this.prisma.stockReservation.update({
              where: { id: existing.id },
              data: { status: ReservationStatus.RELEASED },
            });
            this.broadcastUpdatesForItems(
              existing.items.map((i) => ({ productId: i.productId, variantId: i.variantId }))
            );
          }
        }
      }
    }

    // 2. Sort items deterministically by productId and variantId to prevent deadlocks
    const sortedItems = [...dto.items].sort((a, b) => {
      const cmp = a.productId.localeCompare(b.productId);
      if (cmp !== 0) return cmp;
      return (a.variantId || '').localeCompare(b.variantId || '');
    });

    const now = new Date();
    const tenMinutesMs = 10 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + tenMinutesMs);

    // 3. Execute all-or-nothing reservation inside a PostgreSQL transaction
    const reservationRecord = await this.prisma.$transaction(async (tx) => {
      const reservedItemsPayload: Array<{
        productId: string;
        variantId: string | null;
        productName: string;
        variantName: string | null;
        quantity: number;
        unitPriceCents: number;
        stockQuantity: number;
      }> = [];

      for (const item of sortedItems) {
        // Lock product row
        const lockedProds = await tx.$queryRaw<
          Array<{
            id: string;
            name: string;
            priceCents: number;
            stockQuantity: number;
            isActive: boolean;
          }>
        >`
          SELECT id, name, "priceCents", "stockQuantity", "isActive"
          FROM "Product"
          WHERE id = ${item.productId}
          FOR UPDATE
        `;

        if (!lockedProds || lockedProds.length === 0) {
          throw new NotFoundException(`Product with ID "${item.productId}" not found`);
        }

        const product = lockedProds[0];
        if (!product.isActive) {
          throw new BadRequestException(`Product "${product.name}" is currently inactive`);
        }

        let variant: {
          id: string;
          name: string;
          priceCents: number;
          stockQuantity: number;
          isActive: boolean;
        } | null = null;

        if (item.variantId) {
          const lockedVars = await tx.$queryRaw<
            Array<{
              id: string;
              name: string;
              priceCents: number;
              stockQuantity: number;
              isActive: boolean;
            }>
          >`
            SELECT id, name, "priceCents", "stockQuantity", "isActive"
            FROM "ProductVariant"
            WHERE id = ${item.variantId}
            FOR UPDATE
          `;

          if (!lockedVars || lockedVars.length === 0) {
            throw new NotFoundException(`Variant with ID "${item.variantId}" not found`);
          }
          variant = lockedVars[0];
          if (!variant.isActive) {
            throw new BadRequestException(`Variant "${variant.name}" is currently inactive`);
          }
        }

        // Calculate active reserved stock for this item
        const activeItemReservations = await tx.stockReservationItem.findMany({
          where: {
            productId: item.productId,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            reservation: {
              status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING] },
              expiresAt: { gt: now },
            },
          },
          select: { quantity: true },
        });

        const currentReserved = activeItemReservations.reduce((acc, r) => acc + r.quantity, 0);
        const physicalStock = variant ? variant.stockQuantity : product.stockQuantity;
        const availableStock = Math.max(0, physicalStock - currentReserved);

        if (item.quantity > availableStock) {
          throw new BadRequestException(
            `Insufficient available stock for "${product.name}${variant ? ` - ${variant.name}` : ''}": requested ${item.quantity}, available ${availableStock} (Physical: ${physicalStock}, Reserved: ${currentReserved})`
          );
        }

        const unitPrice = variant ? variant.priceCents : product.priceCents;
        reservedItemsPayload.push({
          productId: product.id,
          variantId: variant ? variant.id : null,
          productName: product.name,
          variantName: variant ? variant.name : null,
          quantity: item.quantity,
          unitPriceCents: unitPrice,
          stockQuantity: physicalStock,
        });
      }

      // Create StockReservation record
      const createdRes = await tx.stockReservation.create({
        data: {
          userId: userId || null,
          sessionId: sessionId || null,
          status: ReservationStatus.ACTIVE,
          expiresAt,
          idempotencyKey: dto.idempotencyKey || null,
          items: {
            create: reservedItemsPayload.map((rp) => ({
              productId: rp.productId,
              variantId: rp.variantId,
              quantity: rp.quantity,
              unitPriceCents: rp.unitPriceCents,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return {
        reservation: createdRes,
        itemsPayload: reservedItemsPayload,
      };
    });

    // 4. Invariant: Broadcast WebSocket inventory updates strictly AFTER transaction commits
    this.broadcastUpdatesForItems(reservationRecord.itemsPayload.map((i) => ({ productId: i.productId, variantId: i.variantId })));

    const remainingSeconds = Math.max(
      0,
      Math.floor((reservationRecord.reservation.expiresAt.getTime() - Date.now()) / 1000)
    );

    return {
      reservationId: reservationRecord.reservation.id,
      status: reservationRecord.reservation.status,
      expiresAt: reservationRecord.reservation.expiresAt.toISOString(),
      expiresInSeconds: remainingSeconds,
      isExpired: false,
      stockAvailable: true,
      items: reservationRecord.reservation.items.map((it) => {
        const payloadItem = reservationRecord.itemsPayload.find(
          (p) => p.productId === it.productId && p.variantId === it.variantId
        );
        return {
          id: it.id,
          productId: it.productId,
          variantId: it.variantId,
          productName: payloadItem?.productName || 'Stationery Item',
          variantName: payloadItem?.variantName || null,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          totalPriceCents: it.unitPriceCents * it.quantity,
          stockQuantity: payloadItem?.stockQuantity || 0,
        };
      }),
    };
  }

  /**
   * Checks current stock availability for an expired reservation.
   * Returns whether stock is still available (Scenario A) or insufficient (Scenario B).
   */
  async checkExpiredStockForReservation(reservationId: string): Promise<{
    reservationId: string;
    isExpired: boolean;
    stockAvailable: boolean;
    message: string;
    unavailableItems?: Array<{
      productId: string;
      variantId: string | null;
      productName: string;
      requestedQuantity: number;
      availableQuantity: number;
    }>;
    items: Array<any>;
  }> {
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, stockQuantity: true, isActive: true } },
            variant: { select: { id: true, name: true, stockQuantity: true, isActive: true } },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation with ID "${reservationId}" not found`);
    }

    const now = new Date();
    const isExpired =
      reservation.expiresAt <= now || reservation.status === ReservationStatus.EXPIRED;

    // Check available stock for each item against physical stock minus OTHER active reservations
    const unavailableItems: Array<{
      productId: string;
      variantId: string | null;
      productName: string;
      requestedQuantity: number;
      availableQuantity: number;
    }> = [];

    for (const item of reservation.items) {
      const otherReservations = await this.prisma.stockReservationItem.findMany({
        where: {
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          reservation: {
            id: { not: reservation.id },
            status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING] },
            expiresAt: { gt: now },
          },
        },
        select: { quantity: true },
      });

      const reservedByOthers = otherReservations.reduce((sum, r) => sum + r.quantity, 0);
      const physicalStock = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;
      const availableStock = Math.max(0, physicalStock - reservedByOthers);

      if (item.quantity > availableStock) {
        unavailableItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          productName: item.product.name,
          requestedQuantity: item.quantity,
          availableQuantity: availableStock,
        });
      }
    }

    const stockAvailable = unavailableItems.length === 0;

    return {
      reservationId: reservation.id,
      isExpired,
      stockAvailable,
      message: stockAvailable
        ? 'Your previous reservation has expired. We checked the latest stock availability, and your selected items are still available. You can continue with payment.'
        : 'Sorry! Some of your selected items are no longer available in the requested quantities.',
      ...(stockAvailable ? {} : { unavailableItems }),
      items: reservation.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        variantId: it.variantId || null,
        productName: it.product.name,
        variantName: it.variant?.name || null,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        totalPriceCents: it.unitPriceCents * it.quantity,
        stockQuantity: it.variant ? it.variant.stockQuantity : it.product.stockQuantity,
      })),
    };
  }

  /**
   * Safely inspects an expired or expiring reservation.
   * Under Phase C: Never automatically generates a brand-new 10-minute reservation if expired.
   * Rechecks current stock and returns Scenario A or Scenario B.
   */
  async renewReservation(
    reservationId: string,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<ReservationResult> {
    const existing = await this.prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: {
        items: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Reservation with ID "${reservationId}" not found`);
    }

    if (existing.status === ReservationStatus.CONSUMED) {
      throw new BadRequestException('Reservation has already been fulfilled and converted to an order');
    }

    // Verify ownership
    if (userId && existing.userId && existing.userId !== userId) {
      throw new BadRequestException('Reservation does not belong to the current authenticated user');
    }
    if (sessionId && existing.sessionId && existing.sessionId !== sessionId) {
      throw new BadRequestException('Reservation does not belong to the current session');
    }

    // Mark as EXPIRED if past expiry
    const now = new Date();
    if (existing.expiresAt <= now && existing.status !== ReservationStatus.EXPIRED) {
      await this.prisma.stockReservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.EXPIRED },
      });
    }

    const check = await this.checkExpiredStockForReservation(reservationId);
    return {
      reservationId: existing.id,
      status: ReservationStatus.EXPIRED,
      expiresAt: existing.expiresAt.toISOString(),
      expiresInSeconds: 0,
      isExpired: true,
      stockAvailable: check.stockAvailable,
      message: check.message,
      ...(check.unavailableItems ? { unavailableItems: check.unavailableItems } : {}),
      items: check.items,
    };
  }

  /**
   * Explicitly releases a stock reservation upon user cancellation or abandonment.
   */
  async releaseReservation(
    reservationId: string,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<{ released: boolean; reservationId: string }> {
    const existing = await this.prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundException(`Reservation with ID "${reservationId}" not found`);
    }

    if (existing.status === ReservationStatus.CONSUMED) {
      throw new BadRequestException('Cannot release an already fulfilled reservation');
    }

    // Verify ownership
    if (userId && existing.userId && existing.userId !== userId) {
      throw new BadRequestException('Reservation does not belong to the current authenticated user');
    }
    if (sessionId && existing.sessionId && existing.sessionId !== sessionId) {
      throw new BadRequestException('Reservation does not belong to the current session');
    }

    await this.prisma.stockReservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.RELEASED },
    });

    // Broadcast inventory release
    this.broadcastUpdatesForItems(
      existing.items.map((i) => ({ productId: i.productId, variantId: i.variantId }))
    );

    return { released: true, reservationId };
  }

  /**
   * Periodic expiry worker: transitions expired reservations to EXPIRED and releases stock.
   * Concurrency safe: Uses atomic updateMany to ensure only one worker processes an expired reservation.
   */
  async releaseExpiredReservations(): Promise<number> {
    const now = new Date();

    const expiredReservations = await this.prisma.stockReservation.findMany({
      where: {
        status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING] },
        expiresAt: { lte: now },
      },
      include: {
        items: true,
      },
      take: 50,
    });

    if (expiredReservations.length === 0) return 0;

    let releasedCount = 0;
    const affectedItems: Array<{ productId: string; variantId: string | null }> = [];

    for (const res of expiredReservations) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const updateRes = await tx.stockReservation.updateMany({
            where: {
              id: res.id,
              status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING] },
              expiresAt: { lte: now },
            },
            data: { status: ReservationStatus.EXPIRED },
          });

          if (updateRes.count === 0) return;

          await tx.paymentAttempt.updateMany({
            where: {
              reservationId: res.id,
              status: { in: [PaymentAttemptStatus.INITIATED, PaymentAttemptStatus.PROCESSING] },
            },
            data: {
              status: PaymentAttemptStatus.EXPIRED,
              failureReason: 'Reservation expired after 10-minute timeout',
            },
          });

          releasedCount++;
          for (const it of res.items) {
            affectedItems.push({ productId: it.productId, variantId: it.variantId });
          }
        });
      } catch (err) {
        this.logger.error(`Failed to expire reservation ${res.id}:`, err);
      }
    }

    if (affectedItems.length > 0) {
      this.logger.log(`Released ${releasedCount} expired stock reservations`);
      this.broadcastUpdatesForItems(affectedItems);
    }

    return releasedCount;
  }

  /**
   * Helper to recalculate and broadcast live stock updates for a list of items.
   */
  private async broadcastUpdatesForItems(
    items: Array<{ productId: string; variantId: string | null }>
  ) {
    if (!this.inventoryGateway) return;

    const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));

    for (const pid of uniqueProductIds) {
      try {
        const prod = await this.prisma.product.findUnique({
          where: { id: pid },
          select: { id: true, stockQuantity: true },
        });
        if (!prod) continue;

        const activeRes = await this.prisma.stockReservationItem.findMany({
          where: {
            productId: pid,
            reservation: {
              status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING] },
              expiresAt: { gt: new Date() },
            },
          },
          select: { quantity: true },
        });

        const reservedStock = activeRes.reduce((s, it) => s + it.quantity, 0);
        const availableStock = Math.max(0, prod.stockQuantity - reservedStock);

        this.inventoryGateway.broadcastStockUpdate({
          productId: prod.id,
          variantId: null,
          physicalStock: prod.stockQuantity,
          reservedStock,
          availableStock,
          timestamp: new Date().toISOString(),
          reason: 'RESERVATION_UPDATE',
        });
      } catch (err) {
        this.logger.error(`Failed to broadcast stock update for product ${pid}:`, err);
      }
    }
  }
}

