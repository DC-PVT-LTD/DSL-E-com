import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { CartService } from '../cart/cart.service';
import { NotificationsService } from '../notifications/notifications.service';
import { generateTrackingToken } from '../orders/utils/tracking-token.util';
import {
  ValidatePayDto,
  ProcessPaymentDto,
  PayHereWebhookDto,
} from './dto/checkout.dto';
import {
  ReservationStatus,
  PaymentAttemptStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  InventoryChangeReason,
} from '../../generated/prisma';
import { PromotionsService } from '../promotions/promotions.service';

export interface SchoolPackSnapshotItem {
  packId: string;
  packName: string;
  slug: string;
  grade: string;
  tier: string;
  savingsPercentage: number;
  originalSubtotalCents: number;
  bundleSubtotalCents?: number;
  discountCents: number;
  bundleDiscountCents?: number;
  finalTotalCents: number;
  items: Array<{
    productId: string;
    variantId: string | null;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
}

export interface AuthoritativeTotals {
  subtotalCents: number;
  discountCents: number;
  bundleDiscountCents: number;
  voucherDiscountCents: number;
  deliveryCents: number;
  totalCents: number;
  freeDeliveryThresholdCents: number;
  isFreeDelivery: boolean;
  voucherApplied?: {
    code: string;
    promotionId?: string;
    promotionCodeId?: string | null;
    promotionName?: string;
    discountType: string;
    discountValue: number;
    isFreeDelivery?: boolean;
    isStackableWithSchoolPacks?: boolean;
  };
  schoolPacksSnapshot?: SchoolPackSnapshotItem[];
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryGateway) private readonly inventoryGateway: InventoryGateway,
    @Inject(CartService) private readonly cartService: CartService,
    @Optional() @Inject(NotificationsService) private readonly notificationsService?: NotificationsService,
    @Optional() @Inject(PromotionsService) private readonly promotionsService?: PromotionsService
  ) {}

  /**
   * Helper to compute authoritative order totals from database product prices, verified school packs,
   * promotions/vouchers, and store delivery settings.
   * Never trusts client-submitted prices, discount percentages, or totals.
   */
  async calculateAuthoritativeTotals(
    reservationItems: Array<{ productId: string; variantId: string | null; quantity: number }>,
    voucherCode?: string | null,
    packSelections?: Array<{ productId: string; variantId?: string | null; packId: string }> | null,
    userId?: string | null,
    customerEmail?: string | null
  ): Promise<AuthoritativeTotals> {
    // 1. Fetch live product prices from database & build item detail map
    let subtotalCents = 0;
    const itemDetails: Array<{
      productId: string;
      variantId: string | null;
      productName: string;
      variantName: string | null;
      sku: string;
      unitPriceCents: number;
      quantity: number;
      lineTotalCents: number;
    }> = [];

    for (const item of reservationItems) {
      const prod = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      });
      if (!prod) throw new NotFoundException(`Product ${item.productId} not found`);

      let unitPrice = prod.priceCents;
      let variantName: string | null = null;
      let sku = prod.sku;

      if (item.variantId) {
        const v = prod.variants.find((vr) => vr.id === item.variantId);
        if (v) {
          unitPrice = v.priceCents;
          variantName = v.name;
          sku = v.sku;
        }
      }

      const lineTotal = unitPrice * item.quantity;
      subtotalCents += lineTotal;

      itemDetails.push({
        productId: item.productId,
        variantId: item.variantId || null,
        productName: prod.name,
        variantName,
        sku,
        unitPriceCents: unitPrice,
        quantity: item.quantity,
        lineTotalCents: lineTotal,
      });
    }

    // 2. Authoritative School Pack Bundle Discounts
    let totalBundleDiscountCents = 0;
    const schoolPacksSnapshot: SchoolPackSnapshotItem[] = [];

    if (packSelections && packSelections.length > 0) {
      // Map item key -> packId
      const selectionMap = new Map<string, string>();
      for (const sel of packSelections) {
        if (sel.packId) {
          const key = `${sel.productId}-${sel.variantId || ''}`;
          selectionMap.set(key, sel.packId);
        }
      }

      // Group reservation items by claimed packId
      const packGroups = new Map<string, typeof itemDetails>();
      for (const it of itemDetails) {
        const key = `${it.productId}-${it.variantId || ''}`;
        const packId = selectionMap.get(key);
        if (packId) {
          if (!packGroups.has(packId)) {
            packGroups.set(packId, []);
          }
          packGroups.get(packId)!.push(it);
        }
      }

      // Verify each pack against PostgreSQL database records
      for (const [packId, claimedItems] of packGroups.entries()) {
        const pack = await this.prisma.schoolPack.findUnique({
          where: { id: packId },
          include: { items: true },
        });

        if (!pack || !pack.isActive) {
          this.logger.warn(`School pack '${packId}' not found or inactive; bundle discount skipped.`);
          continue;
        }

        // Validate that claimed products are actual components or allowed substitutes
        const allowedProductIds = new Set<string>();
        for (const pItem of pack.items) {
          allowedProductIds.add(pItem.productId);
          for (const subId of pItem.substituteProductIds) {
            allowedProductIds.add(subId);
          }
        }

        const validPackItems = claimedItems.filter((ci) => allowedProductIds.has(ci.productId));
        if (validPackItems.length === 0) continue;

        const packSubtotal = validPackItems.reduce((acc, vi) => acc + vi.lineTotalCents, 0);
        // Calculate discount using trusted PostgreSQL savingsPercentage
        const packDiscount = Math.round((packSubtotal * pack.savingsPercentage) / 100);
        totalBundleDiscountCents += packDiscount;

        schoolPacksSnapshot.push({
          packId: pack.id,
          packName: pack.name,
          slug: pack.slug,
          grade: pack.grade,
          tier: pack.tier,
          savingsPercentage: pack.savingsPercentage,
          originalSubtotalCents: packSubtotal,
          bundleSubtotalCents: packSubtotal,
          discountCents: packDiscount,
          bundleDiscountCents: packDiscount,
          finalTotalCents: packSubtotal - packDiscount,
          items: validPackItems.map((vi) => ({
            productId: vi.productId,
            variantId: vi.variantId,
            productName: vi.productName,
            quantity: vi.quantity,
            unitPriceCents: vi.unitPriceCents,
            lineTotalCents: vi.lineTotalCents,
          })),
        });
      }
    }

    // 3. Voucher calculation applied using authoritative PromotionsService
    let voucherDiscountCents = 0;
    let voucherApplied: AuthoritativeTotals['voucherApplied'] | undefined = undefined;
    let isPromoFreeDelivery = false;

    if (voucherCode && voucherCode.trim()) {
      if (this.promotionsService) {
        try {
          const promoResult = await this.promotionsService.calculateAuthoritativeDiscount(
            voucherCode,
            reservationItems,
            packSelections,
            userId,
            customerEmail
          );

          if (promoResult.valid) {
            voucherDiscountCents = promoResult.discountAmountCents;
            isPromoFreeDelivery = promoResult.isFreeDelivery;
            voucherApplied = {
              code: promoResult.code,
              promotionId: promoResult.promotionId,
              promotionCodeId: promoResult.promotionCodeId,
              promotionName: promoResult.promotionName,
              discountType: promoResult.discountType,
              discountValue: promoResult.discountValue,
              isFreeDelivery: promoResult.isFreeDelivery,
              isStackableWithSchoolPacks: promoResult.isStackableWithSchoolPacks,
            };
          }
        } catch (err: any) {
          this.logger.warn(`Voucher ${voucherCode} not applied during totals calculation: ${err.message}`);
        }
      } else {
        // Fallback to direct DB query if promotionsService is not available
        const subtotalEligibleForVoucher = Math.max(0, subtotalCents - totalBundleDiscountCents);
        const promo = await this.prisma.promotion.findUnique({
          where: { code: voucherCode.toUpperCase() },
        });

        if (promo && promo.isActive && promo.startDate <= new Date() && promo.endDate >= new Date()) {
          const hasSchoolPacks = totalBundleDiscountCents > 0;
          const isStackable = promo.isStackableWithSchoolPacks ?? (promo.isStackableWithSchoolPacks === undefined);
          if (!hasSchoolPacks || isStackable) {
            if (!promo.minOrderAmountCents || subtotalEligibleForVoucher >= promo.minOrderAmountCents) {
              if (promo.discountType === 'PERCENTAGE') {
                voucherDiscountCents = Math.round((subtotalEligibleForVoucher * promo.discountValue) / 100);
              } else if (promo.discountType === 'FREE_DELIVERY' || promo.promotionType === 'FREE_DELIVERY') {
                isPromoFreeDelivery = true;
                voucherDiscountCents = 0;
              } else {
                voucherDiscountCents = promo.discountValue > 10000 ? promo.discountValue : promo.discountValue * 100;
              }

              const maxDiscount = promo.maximumDiscountAmount || promo.maxDiscountCents;
              if (maxDiscount) {
                voucherDiscountCents = Math.min(voucherDiscountCents, maxDiscount);
              }

              voucherApplied = {
                code: promo.code || voucherCode.toUpperCase(),
                promotionId: promo.id,
                discountType: promo.discountType,
                discountValue: promo.discountValue,
                isFreeDelivery: isPromoFreeDelivery,
                isStackableWithSchoolPacks: promo.isStackableWithSchoolPacks,
              };
            }
          }
        }
      }
    }

    const totalDiscountCents = totalBundleDiscountCents + voucherDiscountCents;
    const netSubtotalCents = Math.max(0, subtotalCents - totalDiscountCents);

    // 4. Fetch StoreSettings for delivery fees
    const settings = await this.prisma.storeSettings.findUnique({
      where: { id: 'default' },
    });

    const flatDeliveryFeeCents = settings?.flatDeliveryFeeCents ?? 35000; // Rs. 350.00
    const freeDeliveryThresholdCents = settings?.freeDeliveryThresholdCents ?? 500000; // Rs. 5,000.00

    const isFreeDelivery = (netSubtotalCents >= freeDeliveryThresholdCents) || isPromoFreeDelivery;
    const deliveryCents = isFreeDelivery ? 0 : flatDeliveryFeeCents;

    const totalCents = Math.max(0, netSubtotalCents + deliveryCents);

    return {
      subtotalCents,
      discountCents: totalDiscountCents,
      bundleDiscountCents: totalBundleDiscountCents,
      voucherDiscountCents,
      deliveryCents,
      totalCents,
      freeDeliveryThresholdCents,
      isFreeDelivery,
      voucherApplied,
      schoolPacksSnapshot: schoolPacksSnapshot.length > 0 ? schoolPacksSnapshot : undefined,
    };
  }

  /**
   * MANDATORY VALIDATION WHEN PAY IS CLICKED
   * Ensures valid reservation, active stock commitment, authoritative price recalculation,
   * stores checkout snapshot with verified school pack bundle discounts in paymentAttempt,
   * and prepares PayHere hash without leaking secret.
   */
  async validatePrePay(
    dto: ValidatePayDto,
    userId?: string | null,
    sessionId?: string | null
  ) {
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: dto.reservationId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, priceCents: true, stockQuantity: true } },
            variant: { select: { id: true, name: true, priceCents: true, stockQuantity: true } },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation with ID "${dto.reservationId}" not found`);
    }

    // Ownership check
    if (userId && reservation.userId && reservation.userId !== userId) {
      throw new BadRequestException('Reservation does not belong to the current user');
    }
    if (sessionId && reservation.sessionId && reservation.sessionId !== sessionId) {
      throw new BadRequestException('Reservation does not belong to the current session');
    }

    // Check status & expiry
    if (reservation.status === ReservationStatus.CONSUMED) {
      throw new BadRequestException('Reservation has already been completed and converted into an order');
    }

    if (reservation.status === ReservationStatus.RELEASED) {
      throw new BadRequestException('Reservation has been released');
    }

    // Calculate authoritative totals including verified school pack bundle discounts
    const totals = await this.calculateAuthoritativeTotals(
      reservation.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      dto.voucherCode,
      dto.packSelections,
      userId,
      dto.deliveryAddress?.email || null
    );

    const isExpired =
      reservation.status === ReservationStatus.EXPIRED || reservation.expiresAt <= new Date();

    // Deterministically sort items by productId and variantId to prevent deadlocks
    const sortedItems = [...reservation.items].sort((a, b) => {
      const cmp = a.productId.localeCompare(b.productId);
      if (cmp !== 0) return cmp;
      return (a.variantId || '').localeCompare(b.variantId || '');
    });

    // Concurrency-safe stock allocation inside PostgreSQL transaction with row-level pessimistic locking (Phase C)
    await this.prisma.$transaction(async (tx) => {
      for (const item of sortedItems) {
        // Row-level lock on Product
        const lockedProds = await tx.$queryRaw<
          Array<{ id: string; name: string; stockQuantity: number; isActive: boolean }>
        >`
          SELECT id, name, "stockQuantity", "isActive"
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

        let variant: { id: string; name: string; stockQuantity: number; isActive: boolean } | null =
          null;
        if (item.variantId) {
          const lockedVars = await tx.$queryRaw<
            Array<{ id: string; name: string; stockQuantity: number; isActive: boolean }>
          >`
            SELECT id, name, "stockQuantity", "isActive"
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

        // If the reservation had expired (Scenario A), perform a strict concurrency-safe stock check:
        if (isExpired) {
          const otherReservations = await tx.stockReservationItem.findMany({
            where: {
              productId: item.productId,
              ...(item.variantId ? { variantId: item.variantId } : {}),
              reservation: {
                id: { not: reservation.id },
                status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING] },
                expiresAt: { gt: new Date() },
              },
            },
            select: { quantity: true },
          });

          const reservedByOthers = otherReservations.reduce((acc, r) => acc + r.quantity, 0);
          const physicalStock = variant ? variant.stockQuantity : product.stockQuantity;
          const availableStock = Math.max(0, physicalStock - reservedByOthers);

          if (item.quantity > availableStock) {
            throw new BadRequestException(
              `Sorry! Some of your selected items are no longer available in the requested quantities. "${product.name}${variant ? ` - ${variant.name}` : ''}" only has ${availableStock} available.`
            );
          }
        }
      }

      // Atomically secure stock under PAYMENT_PENDING with a bounded 5-minute payment gateway lease
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.PAYMENT_PENDING,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // Bounded payment lease
        },
      });
    });

    // Idempotency: prepare or update PaymentAttempt with full checkout snapshot & pack metadata
    const idempotencyKey = dto.idempotencyKey || `pay-${reservation.id}-${Date.now()}`;
    const orderId = `DSL-${Date.now()}`;

    const gatewayPayloadData: any = {
      orderId,
      deliveryAddress: dto.deliveryAddress,
      voucherCode: dto.voucherCode || null,
      packSelections: dto.packSelections || null,
      userId: userId || null,
      sessionId: sessionId || null,
      totals,
    };

    const paymentAttempt = await this.prisma.paymentAttempt.upsert({
      where: { idempotencyKey },
      create: {
        reservationId: reservation.id,
        amountCents: totals.totalCents,
        currency: 'LKR',
        paymentMethod: dto.paymentMethod,
        status: PaymentAttemptStatus.PROCESSING,
        idempotencyKey,
        gatewayPayload: gatewayPayloadData,
      },
      update: {
        amountCents: totals.totalCents,
        status: PaymentAttemptStatus.PROCESSING,
        gatewayPayload: gatewayPayloadData,
      },
    });

    // Generate official PayHere checkout parameters if PayHere is selected
    let payHerePayload: Record<string, any> | null = null;
    if (dto.paymentMethod === 'CARD_PAYHERE') {
      const merchantId = process.env.PAYHERE_MERCHANT_ID || '1211149';
      const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'dsl_payhere_sandbox_secret';
      const amountFormatted = (totals.totalCents / 100).toFixed(2);
      const currency = 'LKR';

      // Official PayHere MD5 checkout hash:
      // strtoupper(md5(merchant_id + order_id + amountFormatted + currency + strtoupper(md5(merchant_secret))))
      const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
      const hashStr = `${merchantId}${orderId}${amountFormatted}${currency}${hashedSecret}`;
      const hash = crypto.createHash('md5').update(hashStr).digest('hex').toUpperCase();

      payHerePayload = {
        sandbox: true,
        merchant_id: merchantId,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/result?orderId=${orderId}&payment=success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout?payment=cancelled`,
        notify_url: `${process.env.BACKEND_URL || 'http://localhost:4000/api/v1'}/checkout/payhere/webhook`,
        order_id: orderId,
        items: `DSL Stationery Order (${reservation.items.length} items)`,
        amount: amountFormatted,
        currency,
        hash,
        first_name: dto.deliveryAddress.fullName.split(' ')[0],
        last_name: dto.deliveryAddress.fullName.split(' ').slice(1).join(' ') || 'Customer',
        email: dto.deliveryAddress.email,
        phone: dto.deliveryAddress.phone,
        address: dto.deliveryAddress.addressLine1,
        city: dto.deliveryAddress.city,
        country: 'Sri Lanka',
        custom_1: reservation.id,
        custom_2: idempotencyKey,
      };
    }

    return {
      isValid: true,
      reservationId: reservation.id,
      paymentAttemptId: paymentAttempt.id,
      orderId,
      idempotencyKey,
      totals,
      payHerePayload,
    };
  }

  /**
   * Finalizes payment and creates the order transactionally.
   * Converts reserved stock to sold stock, records inventory movement, and emits live updates.
   * Preserves auditable school pack snapshots, bundle discounts, and purchase-time prices.
   */
  async processPayment(
    dto: ProcessPaymentDto,
    userId?: string | null,
    sessionId?: string | null
  ) {
    // 1. Idempotency check: if an order already exists for this idempotency key, return it
    const existingAttempt = await this.prisma.paymentAttempt.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: {
        order: {
          include: {
            items: true,
            addressSnapshot: true,
          },
        },
      },
    });

    if (existingAttempt?.order) {
      this.logger.log(`Duplicate payment request ignored via idempotency key "${dto.idempotencyKey}"`);
      return {
        order: existingAttempt.order,
        isDuplicate: true,
      };
    }

    // 2. Fetch reservation with items
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: dto.reservationId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation with ID "${dto.reservationId}" not found`);
    }

    if (reservation.status === ReservationStatus.CONSUMED) {
      const existingOrder = await this.prisma.order.findFirst({
        where: {
          OR: [
            ...(reservation.orderId ? [{ id: reservation.orderId }] : []),
            { reservation: { id: reservation.id } },
          ],
        },
        include: {
          items: true,
          addressSnapshot: true,
        },
      });

      if (existingOrder) {
        this.logger.log(`Duplicate payment request safely ignored: reservation "${reservation.id}" already completed`);
        return {
          order: existingOrder,
          isDuplicate: true,
        };
      }

      throw new BadRequestException('This reservation has already been completed.');
    }

    if (reservation.status === ReservationStatus.EXPIRED) {
      throw new BadRequestException('Your stock reservation has expired. Please renew before proceeding.');
    }

    if (reservation.status === ReservationStatus.RELEASED) {
      throw new BadRequestException('Your stock reservation has been released. Please renew before proceeding.');
    }

    if (reservation.expiresAt <= new Date() && reservation.status !== ReservationStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Your stock reservation has expired. Please renew before proceeding.');
    }

    // Retrieve pack selections: prefer explicit DTO, then fallback to paymentAttempt gatewayPayload
    const existingPayload = (existingAttempt?.gatewayPayload as any) || {};
    const packSelections = dto.packSelections || existingPayload.packSelections || null;

    // Authoritative totals calculation including verified school packs
    const totals = await this.calculateAuthoritativeTotals(
      reservation.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      dto.voucherCode,
      packSelections,
      userId,
      dto.deliveryAddress.email
    );

    // Collision-free unique order number generation
    let orderNumber = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `DSL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const exists = await this.prisma.order.findUnique({ where: { orderNumber: candidate } });
      if (!exists) {
        orderNumber = candidate;
        break;
      }
    }
    if (!orderNumber) {
      orderNumber = `DSL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }

    // Prepare auditable snapshot for order notes
    let orderNotes = dto.deliveryAddress.deliveryNotes || null;
    if (totals.schoolPacksSnapshot && totals.schoolPacksSnapshot.length > 0) {
      const snapshotData = {
        customerNotes: dto.deliveryAddress.deliveryNotes || null,
        schoolPacks: totals.schoolPacksSnapshot,
        discounts: {
          bundleDiscountCents: totals.bundleDiscountCents,
          voucherDiscountCents: totals.voucherDiscountCents,
          totalDiscountCents: totals.discountCents,
        },
      };
      orderNotes = JSON.stringify(snapshotData);
    }

    // 3. Atomically deduct physical stock, consume reservation, create order and snapshots
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      // Verify reservation was not already consumed concurrently
      const lockedRes = await tx.stockReservation.findUnique({
        where: { id: reservation.id },
      });
      if (!lockedRes || lockedRes.status === ReservationStatus.CONSUMED) {
        throw new BadRequestException('Reservation has already been fulfilled.');
      }

      // Consume reservation
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CONSUMED },
      });

      // Deduct physical stock from products / variants with row-level stock check
      for (const item of reservation.items) {
        if (item.variantId) {
          const lockedVar = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { id: true, stockQuantity: true },
          });
          if (!lockedVar || lockedVar.stockQuantity < item.quantity) {
            throw new BadRequestException(
              `Insufficient physical stock to fulfill variant "${item.variantId}" (available: ${lockedVar?.stockQuantity ?? 0}, requested: ${item.quantity})`
            );
          }

          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }

        const lockedProd = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, stockQuantity: true },
        });
        if (!lockedProd || lockedProd.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient physical stock to fulfill product "${item.productId}" (available: ${lockedProd?.stockQuantity ?? 0}, requested: ${item.quantity})`
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        // Record immutable inventory movement audit log
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId || null,
            previousQuantity: lockedProd.stockQuantity,
            newQuantity: Math.max(0, lockedProd.stockQuantity - item.quantity),
            changeAmount: -item.quantity,
            reason: InventoryChangeReason.ORDER_FULFILLMENT,
            note: `Order ${orderNumber} fulfilled via ${dto.paymentMethod}`,
            performedById: userId || 'SYSTEM_CHECKOUT',
          },
        });
      }

      // Build item records with school pack identity preserved in variantName snapshot
      const orderItemCreates = reservation.items.map((it) => {
        // Find if this item belongs to any verified school pack snapshot
        const packInfo = totals.schoolPacksSnapshot?.find((p) =>
          p.items.some((pi) => pi.productId === it.productId)
        );

        let finalVariantName = it.variant?.name || null;
        if (packInfo) {
          finalVariantName = finalVariantName
            ? `${finalVariantName} [🎒 ${packInfo.packName}]`
            : `[🎒 ${packInfo.packName}]`;
        }

        return {
          productId: it.productId,
          variantId: it.variantId,
          productName: it.product.name,
          variantName: finalVariantName,
          sku: it.variant?.sku || it.product.sku,
          unitPriceCents: it.unitPriceCents,
          quantity: it.quantity,
          totalPriceCents: it.unitPriceCents * it.quantity,
        };
      });

      // Determine initial payment status
      const isPaid = dto.paymentMethod === 'CARD_PAYHERE' || dto.paymentMethod === 'BANK_TRANSFER';
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: userId || null,
          customerName: dto.deliveryAddress.fullName,
          customerEmail: dto.deliveryAddress.email,
          customerPhone: dto.deliveryAddress.phone,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          deliveryCents: totals.deliveryCents,
          totalCents: totals.totalCents,
          paymentMethod: dto.paymentMethod,
          paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
          orderStatus: OrderStatus.CONFIRMED,
          notes: orderNotes,
          promotionId: totals.voucherApplied?.promotionId || null,
          promoCode: totals.voucherApplied?.code || null,
          reservation: {
            connect: { id: reservation.id },
          },
          addressSnapshot: {
            create: {
              fullName: dto.deliveryAddress.fullName,
              phone: dto.deliveryAddress.phone,
              email: dto.deliveryAddress.email,
              addressLine1: dto.deliveryAddress.addressLine1,
              addressLine2: dto.deliveryAddress.addressLine2 || null,
              city: dto.deliveryAddress.city,
              district: dto.deliveryAddress.district,
              postalCode: dto.deliveryAddress.postalCode || null,
              province: dto.deliveryAddress.province || null,
              buildingNo: dto.deliveryAddress.buildingNo || null,
              street: dto.deliveryAddress.street || null,
              landmark: dto.deliveryAddress.landmark || null,
              formattedAddress: dto.deliveryAddress.formattedAddress || null,
              latitude: dto.deliveryAddress.latitude || null,
              longitude: dto.deliveryAddress.longitude || null,
              deliveryNotes: dto.deliveryAddress.deliveryNotes || null,
            },
          },
          items: {
            create: orderItemCreates,
          },
        },
        include: {
          items: true,
          addressSnapshot: true,
        },
      });

      // Update or create payment attempt
      await tx.paymentAttempt.upsert({
        where: { idempotencyKey: dto.idempotencyKey },
        create: {
          reservationId: reservation.id,
          orderId: order.id,
          amountCents: totals.totalCents,
          currency: 'LKR',
          paymentMethod: dto.paymentMethod,
          status: isPaid ? PaymentAttemptStatus.SUCCEEDED : PaymentAttemptStatus.PROCESSING,
          idempotencyKey: dto.idempotencyKey,
          gatewayPayload: {
            ...(existingPayload || {}),
            totals,
            schoolPacksSnapshot: totals.schoolPacksSnapshot,
          },
        },
        update: {
          orderId: order.id,
          status: isPaid ? PaymentAttemptStatus.SUCCEEDED : PaymentAttemptStatus.PROCESSING,
          gatewayPayload: {
            ...(existingPayload || {}),
            totals,
            schoolPacksSnapshot: totals.schoolPacksSnapshot,
          },
        },
      });

      // Record promotion redemption inside the same transaction
      if (
        totals.voucherApplied?.promotionId &&
        (totals.voucherDiscountCents > 0 || totals.voucherApplied.isFreeDelivery)
      ) {
        if (this.promotionsService) {
          await this.promotionsService.recordRedemptionInsideTx(tx, {
            promotionId: totals.voucherApplied.promotionId,
            promotionCodeId: totals.voucherApplied.promotionCodeId,
            orderId: order.id,
            customerId: userId || null,
            customerEmail: dto.deliveryAddress.email,
            discountAmountCents: totals.voucherDiscountCents,
          });
        }
      }

      return order;
    });

    // 4. Clear ONLY purchased items from user/guest cart in background (Phase A)
    try {
      const purchasedItems = reservation.items.map((it) => ({
        productId: it.productId,
        variantId: it.variantId || null,
      }));
      await this.cartService.removePurchasedItems(
        purchasedItems,
        userId,
        sessionId || reservation.sessionId
      );
    } catch (cartErr) {
      this.logger.warn('Failed to remove purchased items from cart after checkout:', cartErr);
    }

    // 5. Broadcast live stock changes after transaction commits
    for (const item of reservation.items) {
      try {
        const p = await this.prisma.product.findUnique({ where: { id: item.productId } });
        if (p && this.inventoryGateway) {
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
            reason: 'ORDER_FULFILLED',
          });
        }
      } catch (wsErr) {
        this.logger.error('Error broadcasting post-order inventory update:', wsErr);
      }
    }

    // 6. Send order confirmation notification
    if (this.notificationsService) {
      this.notificationsService
        .sendOrderConfirmation({
          orderNumber: createdOrder.orderNumber,
          customerName: createdOrder.customerName,
          customerEmail: createdOrder.customerEmail,
          customerPhone: createdOrder.customerPhone,
          totalCents: createdOrder.totalCents,
          paymentMethod: createdOrder.paymentMethod,
          paymentStatus: createdOrder.paymentStatus,
          deliveryAddress: `${createdOrder.addressSnapshot?.addressLine1}, ${createdOrder.addressSnapshot?.city}`,
          items: createdOrder.items.map((it) => ({
            productName: it.productName,
            variantName: it.variantName,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            totalPriceCents: it.totalPriceCents,
          })),
        })
        .catch((err) => this.logger.error('Failed to dispatch order confirmation notification:', err));
    }

    const trackingToken = generateTrackingToken(createdOrder);

    return {
      order: createdOrder,
      isDuplicate: false,
      trackingToken,
    };
  }

  /**
   * Verified PayHere server-to-server webhook callback.
   * Enforces MD5 signature verification, merchant verification, currency check,
   * amount matching, idempotency, and status-dependent stock handling.
   */
  async handlePayHereWebhook(dto: PayHereWebhookDto) {
    const configuredMerchantId = process.env.PAYHERE_MERCHANT_ID || '1211149';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'dsl_payhere_sandbox_secret';

    // 1. Verify notification signature:
    // strtoupper(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(merchant_secret))))
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const checkHashStr = `${dto.merchant_id}${dto.order_id}${dto.payhere_amount}${dto.payhere_currency}${dto.status_code}${hashedSecret}`;
    const calculatedHash = crypto.createHash('md5').update(checkHashStr).digest('hex').toUpperCase();

    if (calculatedHash !== dto.md5sig) {
      this.logger.error(`PayHere signature mismatch for order ${dto.order_id}`);
      throw new BadRequestException('Invalid PayHere signature');
    }

    // 2. Validate merchant ID
    if (dto.merchant_id !== configuredMerchantId) {
      this.logger.error(`PayHere merchant ID mismatch: received ${dto.merchant_id}, expected ${configuredMerchantId}`);
      throw new BadRequestException('Invalid merchant ID');
    }

    // 3. Validate currency
    if (dto.payhere_currency !== 'LKR') {
      this.logger.error(`PayHere currency mismatch: received ${dto.payhere_currency}, expected LKR`);
      throw new BadRequestException('Invalid currency');
    }

    this.logger.log(`PayHere webhook verified for order ${dto.order_id}, status=${dto.status_code}`);

    // 4. Retrieve associated PaymentAttempt via custom_2 (idempotencyKey) or order_id
    const idempotencyKey = dto.custom_2;
    const reservationId = dto.custom_1;

    let paymentAttempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        OR: [
          ...(idempotencyKey ? [{ idempotencyKey }] : []),
          ...(dto.payment_id ? [{ gatewayReference: dto.payment_id }] : []),
          ...(reservationId ? [{ reservationId }] : []),
        ],
      },
      include: {
        reservation: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!paymentAttempt && reservationId) {
      paymentAttempt = await this.prisma.paymentAttempt.findFirst({
        where: { reservationId },
        include: {
          reservation: {
            include: {
              items: true,
            },
          },
        },
      });
    }

    if (!paymentAttempt) {
      this.logger.error(`PayHere webhook could not find payment attempt for order ${dto.order_id}`);
      throw new NotFoundException(`Payment attempt for order ${dto.order_id} not found`);
    }

    // 5. Validate amount matches expected order total
    const expectedAmountFormatted = (paymentAttempt.amountCents / 100).toFixed(2);
    if (Math.abs(parseFloat(dto.payhere_amount) - parseFloat(expectedAmountFormatted)) > 0.01) {
      this.logger.error(
        `PayHere amount mismatch: received ${dto.payhere_amount}, expected ${expectedAmountFormatted}`
      );
      throw new BadRequestException('Payment amount mismatch');
    }

    // 6. Idempotency check: if payment already succeeded, return immediately for duplicate success callbacks
    if (paymentAttempt.status === PaymentAttemptStatus.SUCCEEDED && dto.status_code === '2') {
      this.logger.log(`Duplicate PayHere success notification safely ignored for order ${dto.order_id}`);
      return { status: 'success', message: 'Payment already processed' };
    }

    // 7. Handle Status Codes:
    // status_code: "2" = Success, "0" = Pending, "-1" = Canceled, "-2" = Failed, "-3" = Chargedback
    if (dto.status_code === '2') {
      // Scenario 3: Verify reservation status before fulfilling
      const resStatus = paymentAttempt.reservation?.status;
      const isReservationExpired =
        resStatus === ReservationStatus.EXPIRED ||
        resStatus === ReservationStatus.RELEASED;

      if (isReservationExpired) {
        this.logger.warn(
          `PayHere webhook status=2 received for order ${dto.order_id}, but reservation ${paymentAttempt.reservationId} is ${resStatus}. Verifying physical stock.`
        );

        // Check if physical stock is still sufficient to fulfill without overselling
        let stockSufficient = true;
        if (paymentAttempt.reservation?.items && paymentAttempt.reservation.items.length > 0) {
          for (const item of paymentAttempt.reservation.items) {
            const prod = await this.prisma.product.findUnique({
              where: { id: item.productId },
              select: { stockQuantity: true },
            });
            if (!prod || prod.stockQuantity < item.quantity) {
              stockSufficient = false;
              break;
            }
          }
        } else {
          stockSufficient = false;
        }

        if (!stockSufficient) {
          this.logger.error(
            `Cannot fulfill order for late payment ${dto.payment_id}: reservation is ${resStatus} and physical stock is insufficient. Aborting fulfillment to prevent overselling.`
          );

          await this.prisma.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: {
              status: PaymentAttemptStatus.FAILED,
              gatewayReference: dto.payment_id,
              failureReason:
                'Payment captured after reservation expired; physical inventory was insufficient. Order not confirmed to prevent overselling.',
            },
          });

          return {
            status: 'expired',
            message:
              'Payment received after reservation expired; inventory insufficient. Order not confirmed to prevent overselling.',
          };
        }
      }

      const payloadData = (paymentAttempt.gatewayPayload as any) || {};
      const deliveryAddress = payloadData.deliveryAddress || {
        fullName: dto.card_holder_name || 'Online Customer',
        phone: '+94770000000',
        email: 'customer@dslstationery.lk',
        addressLine1: 'Online Delivery',
        city: 'Colombo',
        district: 'Colombo',
      };

      try {
        // Fulfill order transactionally, preserving verified pack selections from pre-pay payload
        const processResult = await this.processPayment({
          reservationId: paymentAttempt.reservationId,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          idempotencyKey: paymentAttempt.idempotencyKey || `payhere-${dto.payment_id}`,
          deliveryAddress,
          paymentData: dto as any,
          packSelections: payloadData.packSelections || null,
        });

        // Update payment attempt to SUCCEEDED with gateway payment ID
        await this.prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentAttemptStatus.SUCCEEDED,
            gatewayReference: dto.payment_id,
            orderId: processResult.order.id,
          },
        });

        if (this.notificationsService) {
          this.notificationsService
            .sendPaymentOutcome({
              orderNumber: processResult.order.orderNumber,
              customerEmail: processResult.order.customerEmail,
              customerName: processResult.order.customerName,
              status: 'SUCCESS',
              amountCents: paymentAttempt.amountCents,
              paymentId: dto.payment_id,
            })
            .catch((err) => this.logger.error('Failed to dispatch payment success notification:', err));
        }

        return {
          status: 'success',
          orderId: processResult.order.id,
          orderNumber: processResult.order.orderNumber,
        };
      } catch (err: any) {
        this.logger.error(
          `Failed to fulfill order for payment ${dto.payment_id}: ${err?.message}`
        );

        await this.prisma.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentAttemptStatus.FAILED,
            gatewayReference: dto.payment_id,
            failureReason: `Order fulfillment failed: ${err?.message || 'Inventory constraint violation'}`,
          },
        });

        return {
          status: 'failed',
          message: `Payment received but order fulfillment failed: ${err?.message}`,
        };
      }
    }

    if (dto.status_code === '0') {
      await this.prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: PaymentAttemptStatus.PROCESSING,
          gatewayReference: dto.payment_id,
        },
      });
      return { status: 'pending', message: 'Payment verification is pending' };
    }

    // 8. Handle Chargeback (-3):
    // PayHere chargebacks occur after successful payment. They MUST NOT be treated as ordinary
    // pre-payment cancellations or failures, and MUST NEVER automatically restore physical stock that has already been sold.
    if (dto.status_code === '-3') {
      this.logger.warn(
        `PayHere CHARGEBACK received for order ${dto.order_id}, payment_id=${dto.payment_id}. Physical stock will NOT be restored.`
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentAttemptStatus.FAILED,
            gatewayReference: dto.payment_id,
            failureReason: `PayHere Chargeback: ${dto.status_message || 'Customer initiated chargeback dispute'}`,
          },
        });

        // If an order was already created, record chargeback dispute note without restoring stock
        if (paymentAttempt.orderId) {
          const ord = await tx.order.findUnique({ where: { id: paymentAttempt.orderId } });
          if (ord) {
            const chargebackNotice = `[CHARGEBACK DISPUTE - PayHere Ref: ${dto.payment_id}]`;
            const updatedNotes = ord.notes ? `${ord.notes} | ${chargebackNotice}` : chargebackNotice;
            await tx.order.update({
              where: { id: ord.id },
              data: {
                notes: updatedNotes,
              },
            });
          }
        }
      });

      return {
        status: 'chargedback',
        message: 'PayHere chargeback recorded. Physical inventory was not restored.',
        orderId: paymentAttempt.orderId,
      };
    }

    // 9. Handled Failed / Cancelled (-1, -2)
    if (dto.status_code === '-1' || dto.status_code === '-2') {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentAttemptStatus.FAILED,
            gatewayReference: dto.payment_id,
            failureReason:
              dto.status_message || `Payment ${dto.status_code === '-1' ? 'cancelled' : 'failed'} via PayHere`,
          },
        });

        // Release the reservation so stock is immediately available to other customers
        if (paymentAttempt.reservation && paymentAttempt.reservation.status !== ReservationStatus.CONSUMED) {
          await tx.stockReservation.update({
            where: { id: paymentAttempt.reservationId },
            data: { status: ReservationStatus.RELEASED },
          });
        }
      });

      // Broadcast released inventory
      if (paymentAttempt.reservation?.items && this.inventoryGateway) {
        for (const it of paymentAttempt.reservation.items) {
          try {
            const p = await this.prisma.product.findUnique({ where: { id: it.productId } });
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
              const reservedStock = activeRes.reduce((s, item) => s + item.quantity, 0);

              this.inventoryGateway.broadcastStockUpdate({
                productId: p.id,
                variantId: it.variantId || null,
                physicalStock: p.stockQuantity,
                reservedStock,
                availableStock: Math.max(0, p.stockQuantity - reservedStock),
                timestamp: new Date().toISOString(),
                reason: 'PAYMENT_FAILED_RELEASE',
              });
            }
          } catch (wsErr) {
            this.logger.error('Error broadcasting post-failure inventory update:', wsErr);
          }
        }
      }

      if (this.notificationsService) {
        const payloadData = (paymentAttempt.gatewayPayload as any) || {};
        this.notificationsService.sendPaymentOutcome({
          customerEmail: payloadData.deliveryAddress?.email || 'customer@dslstationery.lk',
          customerName: payloadData.deliveryAddress?.fullName || 'Valued Customer',
          status: dto.status_code === '-1' ? 'CANCELLED' : 'FAILED',
          amountCents: paymentAttempt.amountCents,
          paymentId: dto.payment_id,
          reason: dto.status_message || 'Payment not completed',
        }).catch((err) => this.logger.error('Failed to dispatch payment failure notification:', err));
      }

      return { status: 'failed', message: dto.status_message || 'Payment failed or cancelled' };
    }

    return { status: 'ignored', message: `Unhandled status code: ${dto.status_code}` };
  }

  /**
   * Reconciles payment status for orders or attempts where webhook was delayed or ambiguous.
   */
  async reconcilePaymentStatus(idOrNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      },
      include: {
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (order) {
      let parsedSchoolPacks: any = null;
      if (order.notes && order.notes.startsWith('{')) {
        try {
          const parsed = JSON.parse(order.notes);
          parsedSchoolPacks = parsed.schoolPacks || null;
        } catch {
          // ignore
        }
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        isConfirmed: order.orderStatus !== OrderStatus.CANCELLED,
        paymentAttempt: order.paymentAttempts[0] || null,
        schoolPacks: parsedSchoolPacks,
      };
    }

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { idempotencyKey: idOrNumber }],
      },
      include: {
        order: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Order or payment attempt "${idOrNumber}" not found`);
    }

    return {
      orderId: attempt.order?.id || null,
      orderNumber: attempt.order?.orderNumber || null,
      orderStatus: attempt.order?.orderStatus || null,
      paymentStatus: attempt.status,
      isConfirmed: attempt.status === PaymentAttemptStatus.SUCCEEDED,
      paymentAttempt: attempt,
    };
  }
}
