import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersQueryDto, UpdateOrderStatusDto } from './dto/orders-query.dto';
import { BuyAgainResponse, BuyAgainItemResult } from './dto/buy-again.dto';
import { OrderStatus, UserRole, InventoryChangeReason, ReservationStatus } from '../../generated/prisma';
import { createPaginationMeta } from '../../common/pagination/pagination.util';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { generateTrackingToken, verifyTrackingToken } from './utils/tracking-token.util';

export const PERMITTED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(InventoryGateway) private readonly inventoryGateway?: InventoryGateway,
    @Optional() @Inject(NotificationsService) private readonly notificationsService?: NotificationsService
  ) {}

  /**
   * Retrieves an order by ID or orderNumber with full item breakdown, delivery address, and payment attempts.
   * Access requires either staff/admin role, verified customer ownership, or a valid cryptographically signed tracking token.
   */
  async getOrderById(
    idOrNumber: string,
    requestUser?: { id: string; role: UserRole; email?: string } | null,
    trackingToken?: string | null
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, images: true, sku: true },
            },
            variant: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        addressSnapshot: true,
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            paymentMethod: true,
            amountCents: true,
            currency: true,
            gatewayReference: true,
            failureReason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order "${idOrNumber}" not found`);
    }

    // Role-based or ownership check:
    const isStaffOrAdmin =
      requestUser?.role === UserRole.ADMIN ||
      requestUser?.role === UserRole.MANAGER ||
      requestUser?.role === UserRole.STAFF;

    if (!isStaffOrAdmin) {
      const isRegisteredOwner =
        requestUser?.id && order.userId === requestUser.id;
      const isVerifiedCustomerEmailOwner =
        requestUser?.id &&
        requestUser?.email &&
        order.customerEmail.toLowerCase() === requestUser.email.toLowerCase();

      const hasValidTrackingToken = trackingToken
        ? verifyTrackingToken(trackingToken, order)
        : false;

      if (!isRegisteredOwner && !isVerifiedCustomerEmailOwner && !hasValidTrackingToken) {
        throw new ForbiddenException(
          'Guest order tracking requires a valid tracking token or email verification'
        );
      }
    }

    let customerNotes = order.notes;
    let schoolPacksSnapshot: any = null;
    if (order.notes && order.notes.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(order.notes);
        if (parsed.schoolPacks) {
          schoolPacksSnapshot = parsed.schoolPacks;
        }
        if (parsed.customerNotes !== undefined) {
          customerNotes = parsed.customerNotes;
        }
      } catch {
        // preserve original notes string if JSON parsing fails
      }
    }

    return {
      ...order,
      customerNotes,
      schoolPacksSnapshot,
    };
  }

  /**
   * Generates a 6-digit OTP sent to the guest order email address to authorize tracking access.
   */
  async requestTrackingOtp(idOrNumber: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      },
    });

    // To prevent email enumeration, return uniform response even if order not found
    if (!order || order.customerEmail.toLowerCase() !== normalizedEmail) {
      return {
        success: true,
        message: 'If the order and email address match our records, a verification code has been sent.',
      };
    }

    // Cooldown check (60 seconds)
    if (order.trackingOtpLastSentAt) {
      const elapsedSeconds = Math.floor(
        (Date.now() - order.trackingOtpLastSentAt.getTime()) / 1000
      );
      if (elapsedSeconds < 60) {
        throw new BadRequestException(
          `Please wait ${60 - elapsedSeconds} seconds before requesting a new verification code.`
        );
      }
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        trackingOtpHash: otpHash,
        trackingOtpExpiresAt: expiresAt,
        trackingOtpAttempts: 0,
        trackingOtpLastSentAt: new Date(),
      },
    });

    if (this.notificationsService) {
      await this.notificationsService.sendOrderTrackingOtp({
        email: order.customerEmail,
        orderNumber: order.orderNumber,
        otp,
      });
    }

    return {
      success: true,
      message: 'If the order and email address match our records, a verification code has been sent.',
    };
  }

  /**
   * Verifies the 6-digit tracking OTP and issues a cryptographically signed tracking token (30-day validity).
   */
  async verifyTrackingOtp(idOrNumber: string, email: string, otp: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      },
    });

    if (!order || order.customerEmail.toLowerCase() !== normalizedEmail) {
      throw new BadRequestException('Invalid order or verification details');
    }

    if (!order.trackingOtpHash || !order.trackingOtpExpiresAt) {
      throw new BadRequestException(
        'No verification code requested or code has expired. Please request a new code.'
      );
    }

    if (order.trackingOtpExpiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (order.trackingOtpAttempts >= 5) {
      throw new BadRequestException(
        'Too many failed attempts. Please request a new verification code.'
      );
    }

    const candidateHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    const storedHash = order.trackingOtpHash;

    const isMatch =
      candidateHash.length === storedHash.length &&
      crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));

    if (!isMatch) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { trackingOtpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code');
    }

    // Reset OTP fields upon successful verification
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        trackingOtpHash: null,
        trackingOtpExpiresAt: null,
        trackingOtpAttempts: 0,
        trackingOtpLastSentAt: null,
      },
    });

    // Generate signed tracking token
    const trackingToken = generateTrackingToken(order);

    return {
      success: true,
      message: 'Tracking verification successful',
      trackingToken,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  }

  /**
   * Retrieves paginated orders filtered by role/ownership and query parameters.
   */
  async getOrders(
    query: OrdersQueryDto,
    requestUser?: { id: string; role: UserRole; email?: string } | null
  ) {
    const isStaffOrAdmin =
      requestUser?.role === UserRole.ADMIN ||
      requestUser?.role === UserRole.MANAGER ||
      requestUser?.role === UserRole.STAFF;

    const where: any = {};

    if (!isStaffOrAdmin) {
      if (!requestUser?.id) {
        throw new ForbiddenException('Authentication required to view order history');
      }
      where.userId = requestUser.id;
    }

    if (query.status) {
      where.orderStatus = query.status;
    }

    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerEmail: { contains: query.search, mode: 'insensitive' } },
        { customerPhone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          addressSnapshot: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  /**
   * Updates order status enforcing permitted transitions and restoring stock upon cancellation exactly once.
   */
  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    actor?: { id: string; role: UserRole }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        addressSnapshot: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }

    const allowed = PERMITTED_STATUS_TRANSITIONS[order.orderStatus] || [];
    if (!allowed.includes(dto.status)) {
      throw new ForbiddenException(
        `Transition from ${order.orderStatus} to ${dto.status} is not permitted.`
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // If transitioning to CANCELLED, restore physical stock if order was previously confirmed/fulfilled
      if (dto.status === OrderStatus.CANCELLED) {
        const restoreNotePattern = `Restored stock from cancelled order ${order.orderNumber}`;
        const alreadyRestored = await tx.inventoryMovement.findFirst({
          where: { note: { contains: restoreNotePattern } },
        });

        if (!alreadyRestored && order.items && order.items.length > 0) {
          for (const item of order.items) {
            if (item.variantId) {
              const currentVar = await tx.productVariant.findUnique({
                where: { id: item.variantId },
                select: { stockQuantity: true },
              });
              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stockQuantity: { increment: item.quantity } },
              });
            }

            const currentProd = await tx.product.findUnique({
              where: { id: item.productId },
              select: { stockQuantity: true },
            });

            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });

            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                variantId: item.variantId || null,
                previousQuantity: currentProd?.stockQuantity ?? 0,
                newQuantity: (currentProd?.stockQuantity ?? 0) + item.quantity,
                changeAmount: item.quantity,
                reason: InventoryChangeReason.RESTOCK,
                note: restoreNotePattern,
                performedById: actor?.id || 'SYSTEM_CANCELLATION',
              },
            });
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          orderStatus: dto.status,
          trackingNumber: dto.trackingNumber !== undefined ? dto.trackingNumber : order.trackingNumber,
          notes: dto.notes !== undefined ? dto.notes : order.notes,
        },
        include: {
          items: true,
          addressSnapshot: true,
        },
      });
    });

    this.logger.log(`Order ${order.orderNumber} status changed: ${order.orderStatus} -> ${dto.status}`);

    // If stock was restored, broadcast stock updates after transaction commits
    if (dto.status === OrderStatus.CANCELLED && this.inventoryGateway && order.items) {
      for (const item of order.items) {
        try {
          const p = await this.prisma.product.findUnique({ where: { id: item.productId } });
          if (p) {
            const activeRes = await this.prisma.stockReservationItem.findMany({
              where: {
                productId: p.id,
                reservation: {
                  status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING] },
                  expiresAt: { gt: new Date() },
                },
              },
              select: { quantity: true },
            });
            const reservedStock = activeRes.reduce((s, it) => s + it.quantity, 0);

            this.inventoryGateway.broadcastStockUpdate({
              productId: p.id,
              variantId: item.variantId || null,
              physicalStock: p.stockQuantity,
              reservedStock,
              availableStock: Math.max(0, p.stockQuantity - reservedStock),
              timestamp: new Date().toISOString(),
              reason: 'ORDER_CANCELLED',
            });
          }
        } catch (wsErr) {
          this.logger.error('Error broadcasting post-cancellation inventory update:', wsErr);
        }
      }
    }

    // Trigger notification if configured
    if (this.notificationsService && dto.status === OrderStatus.CANCELLED) {
      this.notificationsService.sendPaymentOutcome({
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        status: 'CANCELLED',
        amountCents: order.totalCents,
        reason: dto.notes || 'Order cancelled by staff/system',
      }).catch((err) => this.logger.error('Failed to dispatch cancellation notification:', err));
    }

    return updated;
  }

  /**
   * Phase 15.3: Evaluates previous order items for reordering (Buy Again).
   * Validates customer ownership, checks live catalog/inventory, resolves variants and bundles,
   * and prepares authoritative items for cart transfer without placing an order or reserving stock.
   */
  async buyAgain(
    orderId: string,
    requestUser: { id: string; role: UserRole; email?: string }
  ): Promise<BuyAgainResponse> {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }],
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }

    // Role-based or ownership check:
    const isStaffOrAdmin =
      requestUser.role === UserRole.ADMIN ||
      requestUser.role === UserRole.MANAGER ||
      requestUser.role === UserRole.STAFF;

    if (!isStaffOrAdmin) {
      const isOwner =
        (requestUser.id && order.userId === requestUser.id) ||
        (requestUser.email && order.customerEmail.toLowerCase() === requestUser.email.toLowerCase());

      if (!isOwner) {
        throw new ForbiddenException('You do not have permission to reorder products from this order');
      }
    }

    // Check if order has schoolPacks in notes
    let schoolPacksSnapshot: any[] = [];
    if (order.notes && order.notes.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(order.notes);
        if (Array.isArray(parsed.schoolPacks)) {
          schoolPacksSnapshot = parsed.schoolPacks;
        }
      } catch {
        // ignore
      }
    }

    const items: BuyAgainItemResult[] = [];

    for (const orderItem of order.items) {
      // 1. Fetch fresh product from DB
      const freshProduct = await this.prisma.product.findUnique({
        where: { id: orderItem.productId },
        include: { variants: true },
      });

      if (!freshProduct) {
        items.push({
          orderItemId: orderItem.id,
          productId: orderItem.productId,
          variantId: orderItem.variantId,
          productName: orderItem.productName,
          variantName: orderItem.variantName,
          sku: orderItem.sku,
          images: [],
          requestedQuantity: orderItem.quantity,
          availableQuantity: 0,
          currentPriceCents: orderItem.unitPriceCents,
          historicalPriceCents: orderItem.unitPriceCents,
          priceChanged: false,
          status: 'UNAVAILABLE',
          reason: 'PRODUCT_NOT_FOUND',
          bundleInfo: null,
          product: null,
          variant: null,
        });
        continue;
      }

      if (!freshProduct.isActive) {
        items.push({
          orderItemId: orderItem.id,
          productId: freshProduct.id,
          variantId: orderItem.variantId,
          productName: freshProduct.name,
          variantName: orderItem.variantName,
          sku: freshProduct.sku,
          images: freshProduct.images || [],
          requestedQuantity: orderItem.quantity,
          availableQuantity: 0,
          currentPriceCents: freshProduct.priceCents,
          historicalPriceCents: orderItem.unitPriceCents,
          priceChanged: freshProduct.priceCents !== orderItem.unitPriceCents,
          status: 'UNAVAILABLE',
          reason: 'DISCONTINUED',
          bundleInfo: null,
          product: {
            id: freshProduct.id,
            name: freshProduct.name,
            slug: freshProduct.slug,
            sku: freshProduct.sku,
            priceCents: freshProduct.priceCents,
            stockQuantity: freshProduct.stockQuantity,
            isActive: freshProduct.isActive,
            images: freshProduct.images,
            categoryId: freshProduct.categoryId,
            brandId: freshProduct.brandId,
          },
          variant: null,
        });
        continue;
      }

      // Check variant if applicable
      let freshVariant: any = null;
      if (orderItem.variantId) {
        freshVariant = freshProduct.variants.find((v) => v.id === orderItem.variantId);
        if (!freshVariant || !freshVariant.isActive) {
          items.push({
            orderItemId: orderItem.id,
            productId: freshProduct.id,
            variantId: orderItem.variantId,
            productName: freshProduct.name,
            variantName: orderItem.variantName || 'Variant',
            sku: orderItem.sku,
            images: freshProduct.images || [],
            requestedQuantity: orderItem.quantity,
            availableQuantity: 0,
            currentPriceCents: freshVariant ? freshVariant.priceCents : orderItem.unitPriceCents,
            historicalPriceCents: orderItem.unitPriceCents,
            priceChanged: freshVariant ? freshVariant.priceCents !== orderItem.unitPriceCents : false,
            status: 'UNAVAILABLE',
            reason: 'VARIANT_DISCONTINUED',
            bundleInfo: null,
            product: {
              id: freshProduct.id,
              name: freshProduct.name,
              slug: freshProduct.slug,
              sku: freshProduct.sku,
              priceCents: freshProduct.priceCents,
              stockQuantity: freshProduct.stockQuantity,
              isActive: freshProduct.isActive,
              images: freshProduct.images,
              categoryId: freshProduct.categoryId,
              brandId: freshProduct.brandId,
            },
            variant: freshVariant
              ? {
                  id: freshVariant.id,
                  name: freshVariant.name,
                  sku: freshVariant.sku,
                  priceCents: freshVariant.priceCents,
                  stockQuantity: freshVariant.stockQuantity,
                  isActive: freshVariant.isActive,
                }
              : null,
          });
          continue;
        }
      }

      const availableStock = freshVariant ? freshVariant.stockQuantity : freshProduct.stockQuantity;
      const currentPriceCents = freshVariant ? freshVariant.priceCents : freshProduct.priceCents;
      const priceChanged = currentPriceCents !== orderItem.unitPriceCents;

      // Check School Pack bundle
      let bundleInfo: { packId: string; packName: string; savingsPercentage: number } | null = null;
      if (schoolPacksSnapshot.length > 0) {
        const matchingPackSnapshot = schoolPacksSnapshot.find((p) =>
          Array.isArray(p.items) &&
          p.items.some(
            (it: any) =>
              it.productId === orderItem.productId &&
              (it.variantId || null) === (orderItem.variantId || null)
          )
        );
        if (matchingPackSnapshot?.packId) {
          const packInDb = await this.prisma.schoolPack.findUnique({
            where: { id: matchingPackSnapshot.packId },
          });
          if (packInDb && packInDb.isActive) {
            bundleInfo = {
              packId: packInDb.id,
              packName: packInDb.name,
              savingsPercentage: packInDb.savingsPercentage,
            };
          }
        }
      }

      let status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
      let availableQuantity: number;
      let reason:
        | 'AVAILABLE'
        | 'PRICE_CHANGED'
        | 'INSUFFICIENT_STOCK'
        | 'OUT_OF_STOCK';

      if (availableStock >= orderItem.quantity) {
        status = 'AVAILABLE';
        availableQuantity = orderItem.quantity;
        reason = priceChanged ? 'PRICE_CHANGED' : 'AVAILABLE';
      } else if (availableStock > 0) {
        status = 'PARTIAL';
        availableQuantity = availableStock;
        reason = 'INSUFFICIENT_STOCK';
      } else {
        status = 'UNAVAILABLE';
        availableQuantity = 0;
        reason = 'OUT_OF_STOCK';
      }

      items.push({
        orderItemId: orderItem.id,
        productId: freshProduct.id,
        variantId: freshVariant ? freshVariant.id : null,
        productName: freshProduct.name,
        variantName: freshVariant ? freshVariant.name : null,
        sku: freshVariant ? freshVariant.sku : freshProduct.sku,
        images: freshProduct.images || [],
        requestedQuantity: orderItem.quantity,
        availableQuantity,
        currentPriceCents,
        historicalPriceCents: orderItem.unitPriceCents,
        priceChanged,
        status,
        reason,
        bundleInfo,
        product: {
          id: freshProduct.id,
          name: freshProduct.name,
          slug: freshProduct.slug,
          sku: freshProduct.sku,
          priceCents: freshProduct.priceCents,
          stockQuantity: freshProduct.stockQuantity,
          isActive: freshProduct.isActive,
          images: freshProduct.images,
          categoryId: freshProduct.categoryId,
          brandId: freshProduct.brandId,
        },
        variant: freshVariant
          ? {
              id: freshVariant.id,
              name: freshVariant.name,
              sku: freshVariant.sku,
              priceCents: freshVariant.priceCents,
              stockQuantity: freshVariant.stockQuantity,
              isActive: freshVariant.isActive,
            }
          : null,
      });
    }

    const availableCount = items.filter((i) => i.status === 'AVAILABLE').length;
    const partialCount = items.filter((i) => i.status === 'PARTIAL').length;
    const unavailableCount = items.filter((i) => i.status === 'UNAVAILABLE').length;
    const totalAddedQuantity = items.reduce((sum, i) => sum + i.availableQuantity, 0);
    const estimatedTotalCents = items.reduce(
      (sum, i) => sum + i.availableQuantity * i.currentPriceCents,
      0
    );

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      items,
      summary: {
        totalRequestedItems: items.length,
        availableCount,
        partialCount,
        unavailableCount,
        totalAddedQuantity,
        estimatedTotalCents,
      },
    };
  }
}
