import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotificationsService,
  DefiniteDeliveryException,
  UncertainDeliveryTimeoutException,
} from '../notifications/notifications.service';
import { BackInStockAlertStatus } from '../../generated/prisma';
import { BackInStockAlertResponseDto } from './dto/back-in-stock.dto';

@Injectable()
export class BackInStockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackInStockService.name);
  public readonly leaseTimeoutMs: number;
  private readonly recoveryIntervalMs: number;
  private recoveryInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService
  ) {
    this.leaseTimeoutMs =
      this.configService?.get<number>('BACK_IN_STOCK_LEASE_TIMEOUT_MS', 5 * 60 * 1000) ??
      5 * 60 * 1000;
    this.recoveryIntervalMs =
      this.configService?.get<number>('BACK_IN_STOCK_RECOVERY_INTERVAL_MS', 60 * 1000) ??
      60 * 1000;
  }

  onModuleInit() {
    if (process.env.NODE_ENV !== 'test') {
      this.recoveryInterval = setInterval(async () => {
        try {
          await this.recoverStaleAlerts();
        } catch (err) {
          this.logger.error('Error during scheduled stale alert recovery:', err);
        }
      }, this.recoveryIntervalMs);
    }
  }

  onModuleDestroy() {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
  }

  /**
   * Subscribes an authenticated customer to back-in-stock alerts for a product.
   * Idempotent: returns existing active subscription if already subscribed.
   */
  async subscribe(userId: string, productId: string): Promise<BackInStockAlertResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        priceCents: true,
        stockQuantity: true,
        isActive: true,
        images: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found or is currently inactive');
    }

    if (product.stockQuantity > 0) {
      throw new BadRequestException(
        'This product is currently in stock. You can add it directly to your cart.'
      );
    }

    // Check for existing active subscription
    const existing = await this.prisma.backInStockAlert.findFirst({
      where: {
        userId,
        productId,
        status: { in: [BackInStockAlertStatus.PENDING, BackInStockAlertStatus.PROCESSING] },
      },
    });

    if (existing) {
      return {
        id: existing.id,
        userId: existing.userId,
        productId: existing.productId,
        status: existing.status,
        sentAt: existing.sentAt,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
        isAlreadySubscribed: true,
        message: "You're already subscribed to alerts for this product.",
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          priceCents: product.priceCents,
          stockQuantity: product.stockQuantity,
          isActive: product.isActive,
          images: product.images,
        },
      };
    }

    const created = await this.prisma.backInStockAlert.create({
      data: {
        userId,
        productId,
        status: BackInStockAlertStatus.PENDING,
      },
    });

    this.logger.log(`Customer ${userId} subscribed to back-in-stock alerts for product ${productId} (${product.name})`);

    return {
      id: created.id,
      userId: created.userId,
      productId: created.productId,
      status: created.status,
      sentAt: created.sentAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      isAlreadySubscribed: false,
      message: 'You have been subscribed to back-in-stock alerts for this item.',
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        priceCents: product.priceCents,
        stockQuantity: product.stockQuantity,
        isActive: product.isActive,
        images: product.images,
      },
    };
  }

  /**
   * Retrieves all back-in-stock alert subscriptions for the authenticated customer.
   */
  async getMyAlerts(userId: string): Promise<BackInStockAlertResponseDto[]> {
    const alerts = await this.prisma.backInStockAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            priceCents: true,
            compareAtPriceCents: true,
            stockQuantity: true,
            isActive: true,
            images: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    return alerts.map((a) => ({
      id: a.id,
      userId: a.userId,
      productId: a.productId,
      status: a.status,
      sentAt: a.sentAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      product: a.product
        ? {
            id: a.product.id,
            name: a.product.name,
            slug: a.product.slug,
            sku: a.product.sku,
            priceCents: a.product.priceCents,
            compareAtPriceCents: a.product.compareAtPriceCents,
            stockQuantity: a.product.stockQuantity,
            isActive: a.product.isActive,
            images: a.product.images,
            categoryName: a.product.category?.name,
          }
        : undefined,
    }));
  }

  /**
   * Cancels an active back-in-stock alert.
   */
  async cancelAlert(userId: string, alertId: string): Promise<{ success: boolean; message: string }> {
    const alert = await this.prisma.backInStockAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID "${alertId}" not found`);
    }

    if (alert.userId !== userId) {
      throw new ForbiddenException('You do not have permission to cancel this alert');
    }

    if (alert.status === BackInStockAlertStatus.SENT) {
      throw new BadRequestException('This alert has already been sent and cannot be cancelled');
    }

    if (alert.status === BackInStockAlertStatus.CANCELLED) {
      return { success: true, message: 'Alert was already cancelled' };
    }

    await this.prisma.backInStockAlert.update({
      where: { id: alertId },
      data: { status: BackInStockAlertStatus.CANCELLED },
    });

    this.logger.log(`[BACK_IN_STOCK_ALERT] [CANCELLED] Customer ${userId} cancelled alert ${alertId}`);
    return { success: true, message: 'Subscription cancelled successfully' };
  }

  /**
   * Checks subscription status for an authenticated customer and a given product.
   */
  async getStatus(userId: string, productId: string): Promise<{ isSubscribed: boolean; alertId?: string }> {
    const active = await this.prisma.backInStockAlert.findFirst({
      where: {
        userId,
        productId,
        status: { in: [BackInStockAlertStatus.PENDING, BackInStockAlertStatus.PROCESSING] },
      },
      select: { id: true },
    });

    return {
      isSubscribed: !!active,
      alertId: active?.id,
    };
  }

  /**
   * Authoritative stock restock processor.
   * Triggered when a product transitions from 0 to positive stock in InventoryService.
   */
  async processStockRestocked(productId: string): Promise<{ processedCount: number; sentCount: number }> {
    // 1. Find all PENDING alerts for this product
    const pendingAlerts = await this.prisma.backInStockAlert.findMany({
      where: {
        productId,
        status: BackInStockAlertStatus.PENDING,
      },
      select: { id: true },
    });

    if (pendingAlerts.length === 0) {
      return { processedCount: 0, sentCount: 0 };
    }

    const alertIds = pendingAlerts.map((a) => a.id);
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + this.leaseTimeoutMs);

    // 2. Atomically claim alerts by transitioning them to PROCESSING with a lease to prevent duplicate worker execution
    const claimedCount = await this.prisma.backInStockAlert.updateMany({
      where: {
        id: { in: alertIds },
        status: BackInStockAlertStatus.PENDING,
      },
      data: {
        status: BackInStockAlertStatus.PROCESSING,
        processingStartedAt: now,
        leaseExpiresAt,
      },
    });

    if (claimedCount.count === 0) {
      return { processedCount: 0, sentCount: 0 };
    }

    // 3. Fetch full product and user records for claimed alerts
    const claimedAlerts = await this.prisma.backInStockAlert.findMany({
      where: {
        id: { in: alertIds },
        status: BackInStockAlertStatus.PROCESSING,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            priceCents: true,
            stockQuantity: true,
            isActive: true,
            images: true,
          },
        },
      },
    });

    let sentCount = 0;

    for (const alert of claimedAlerts) {
      this.logger.log(`[BACK_IN_STOCK_ALERT] [CLAIMED] Alert ${alert.id} claimed for product ${productId}`);

      // Re-verify product stock and status before dispatching email
      if (!alert.product || !alert.product.isActive || alert.product.stockQuantity <= 0) {
        this.logger.log(
          `[BACK_IN_STOCK_ALERT] [SKIPPED_OUT_OF_STOCK] Product ${productId} is no longer in stock or active. Reverting alert ${alert.id} to PENDING.`
        );
        await this.prisma.backInStockAlert.update({
          where: { id: alert.id },
          data: {
            status: BackInStockAlertStatus.PENDING,
            processingStartedAt: null,
            leaseExpiresAt: null,
            uncertainDelivery: false,
          },
        });
        continue;
      }

      // Generate or reuse idempotency key for reliable retries
      const idempotencyKey =
        alert.idempotencyKey || `bis-${alert.id}-attempt-${(alert.deliveryAttempts || 0) + 1}`;

      await this.prisma.backInStockAlert.update({
        where: { id: alert.id },
        data: {
          deliveryAttempts: { increment: 1 },
          lastAttemptAt: new Date(),
          idempotencyKey,
        },
      });

      this.logger.log(
        `[BACK_IN_STOCK_ALERT] [DELIVERY_STARTED] Alert ${alert.id} delivery started for product ${productId} (attempt ${(alert.deliveryAttempts || 0) + 1})`
      );

      try {
        const sendResult = await this.notificationsService.sendBackInStockAlert({
          customerName: alert.user.name,
          customerEmail: alert.user.email,
          productName: alert.product.name,
          productSlug: alert.product.slug,
          imageUrl: alert.product.images?.[0] || null,
          priceCents: alert.product.priceCents,
          idempotencyKey,
        });

        await this.prisma.backInStockAlert.update({
          where: { id: alert.id },
          data: {
            status: BackInStockAlertStatus.SENT,
            sentAt: new Date(),
            failureReason: null,
            uncertainDelivery: false,
            leaseExpiresAt: null,
          },
        });
        sentCount++;
        this.logger.log(
          `[BACK_IN_STOCK_ALERT] [DELIVERY_CONFIRMED] Alert ${alert.id} confirmed delivered (messageId: ${sendResult?.messageId ?? 'confirmed'})`
        );
      } catch (sendErr: any) {
        if (sendErr instanceof UncertainDeliveryTimeoutException) {
          // Provider timed out without confirmation: mark uncertain and hold PROCESSING lease
          // so we avoid an immediate duplicate retry storm.
          await this.prisma.backInStockAlert.update({
            where: { id: alert.id },
            data: {
              uncertainDelivery: true,
              failureReason: `Uncertain provider timeout: ${sendErr.message}`,
            },
          });
          this.logger.warn(
            `[BACK_IN_STOCK_ALERT] [DELIVERY_UNCERTAIN] Alert ${alert.id} provider response timed out: ${sendErr.message}. Holding lease until expiration.`
          );
        } else {
          // Definite failure: revert to PENDING so it can be retried safely
          await this.prisma.backInStockAlert.update({
            where: { id: alert.id },
            data: {
              status: BackInStockAlertStatus.PENDING,
              failureReason: sendErr?.message || 'Email delivery failed',
              uncertainDelivery: false,
              leaseExpiresAt: null,
              processingStartedAt: null,
            },
          });
          this.logger.error(
            `[BACK_IN_STOCK_ALERT] [DELIVERY_FAILED] Alert ${alert.id} delivery failed definitely: ${sendErr?.message}`
          );
        }
      }
    }

    this.logger.log(
      `Back-in-stock alerts processing completed for product ${productId}: claimed=${claimedCount.count}, sent=${sentCount}`
    );

    return {
      processedCount: claimedCount.count,
      sentCount,
    };
  }

  /**
   * Recovers stale alerts that remained in PROCESSING beyond their lease duration
   * due to server restarts, crashed workers, or unhandled failures.
   */
  async recoverStaleAlerts(customTimeoutMs?: number): Promise<{ recoveredCount: number; retriedCount: number }> {
    const now = new Date();
    const timeoutMs = customTimeoutMs ?? this.leaseTimeoutMs;
    const cutoffDate = new Date(now.getTime() - timeoutMs);

    // Stale alerts are in PROCESSING with either leaseExpiresAt <= now OR older processingStartedAt/updatedAt
    const staleAlerts = await this.prisma.backInStockAlert.findMany({
      where: {
        status: BackInStockAlertStatus.PROCESSING,
        OR: [
          { leaseExpiresAt: { lte: now } },
          { leaseExpiresAt: null, processingStartedAt: { lte: cutoffDate } },
          { leaseExpiresAt: null, processingStartedAt: null, updatedAt: { lte: cutoffDate } },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            stockQuantity: true,
            isActive: true,
          },
        },
      },
    });

    if (staleAlerts.length === 0) {
      return { recoveredCount: 0, retriedCount: 0 };
    }

    let recoveredCount = 0;
    const productsToReprocess = new Set<string>();

    for (const alert of staleAlerts) {
      // Atomic recovery: only update if still in PROCESSING to prevent race conditions
      const updateResult = await this.prisma.backInStockAlert.updateMany({
        where: {
          id: alert.id,
          status: BackInStockAlertStatus.PROCESSING,
        },
        data: {
          status: BackInStockAlertStatus.PENDING,
          processingStartedAt: null,
          leaseExpiresAt: null,
          uncertainDelivery: false,
        },
      });

      if (updateResult.count > 0) {
        recoveredCount++;
        this.logger.log(
          `[BACK_IN_STOCK_ALERT] [RECOVERED] Stale alert ${alert.id} for product ${alert.productId} recovered to PENDING`
        );

        // Recheck live product stock before scheduling retry
        if (alert.product && alert.product.isActive && alert.product.stockQuantity > 0) {
          productsToReprocess.add(alert.productId);
        } else {
          this.logger.log(
            `[BACK_IN_STOCK_ALERT] [SKIPPED_OUT_OF_STOCK] Alert ${alert.id} recovered to PENDING but product ${alert.productId} is out of stock`
          );
        }
      }
    }

    let retriedCount = 0;
    for (const prodId of productsToReprocess) {
      try {
        const res = await this.processStockRestocked(prodId);
        retriedCount += res.sentCount;
      } catch (err: any) {
        this.logger.error(`Failed to reprocess recovered alerts for product ${prodId}:`, err);
      }
    }

    return { recoveredCount, retriedCount };
  }
}

