import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminOrdersQueryDto,
  AdminUpdateStatusDto,
  AdminUpdateCustomerDto,
  AdminUpdateDeliveryDto,
  AdminUpdateItemsDto,
  AdminCancelOrderDto,
  AdminCreateReturnDto,
  AdminProcessReturnDto,
  AdminProcessRefundDto,
  AdminApproveRefundDto,
  AdminProcessRefundExecutionDto,
  AdminCompleteRefundDto,
  AdminRejectRefundDto,
  AdminFailRefundDto,
  AdminAddNoteDto,
  AdminReconciliationQueryDto,
} from './dto/admin-orders.dto';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentAttemptStatus,
  ReturnStatus,
  ReturnItemStatus,
  RefundStatus,
  InventoryChangeReason,
  UserRole,
  Prisma,
} from '../../generated/prisma';
import { createPaginationMeta } from '../../common/pagination/pagination.util';
import { OrdersGateway } from './orders.gateway';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { NotificationsService } from '../notifications/notifications.service';

export const PERMITTED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

const DEFAULT_FLAT_DELIVERY_CENTS = 35000; // Rs. 350.00
const DEFAULT_FREE_DELIVERY_THRESHOLD_CENTS = 500000; // Rs. 5,000.00

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(OrdersGateway) private readonly ordersGateway?: OrdersGateway,
    @Optional() @Inject(InventoryGateway) private readonly inventoryGateway?: InventoryGateway,
    @Optional() @Inject(NotificationsService) private readonly notificationsService?: NotificationsService
  ) { }

  /**
   * Retrieves aggregated dashboard order statistics.
   */
  async getOrderStats() {
    const [
      total,
      pending,
      confirmed,
      processing,
      packed,
      shipped,
      delivered,
      cancelled,
      revenueAggregate,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { orderStatus: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { orderStatus: OrderStatus.CONFIRMED } }),
      this.prisma.order.count({ where: { orderStatus: OrderStatus.PROCESSING } }),
      this.prisma.order.count({ where: { orderStatus: OrderStatus.PACKED } }),
      this.prisma.order.count({ where: { orderStatus: OrderStatus.SHIPPED } }),
      this.prisma.order.count({ where: { orderStatus: OrderStatus.DELIVERED } }),
      this.prisma.order.count({ where: { orderStatus: OrderStatus.CANCELLED } }),
      this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          orderStatus: { not: OrderStatus.CANCELLED },
        },
      }),
    ]);

    return {
      total,
      pending,
      confirmed,
      processing,
      packed,
      shipped,
      delivered,
      cancelled,
      totalRevenueCents: revenueAggregate._sum.totalCents || 0,
    };
  }

  /**
   * Retrieves paginated orders filtered by search, status, paymentStatus, and date range.
   */
  async getOrders(query: AdminOrdersQueryDto) {
    const where: any = {};

    if (query.status && query.status !== 'all') {
      const upper = query.status.toUpperCase();
      if (Object.values(OrderStatus).includes(upper as OrderStatus)) {
        where.orderStatus = upper as OrderStatus;
      }
    }

    if (query.paymentStatus && query.paymentStatus !== 'all') {
      const upper = query.paymentStatus.toUpperCase();
      if (Object.values(PaymentStatus).includes(upper as PaymentStatus)) {
        where.paymentStatus = upper as PaymentStatus;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { customerName: { contains: term, mode: 'insensitive' } },
        { customerEmail: { contains: term, mode: 'insensitive' } },
        { customerPhone: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const orderBy: any = {};
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder || 'desc';
    orderBy[sortField] = sortDir;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, images: true, sku: true },
              },
            },
          },
          addressSnapshot: true,
          paymentAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          returnRequests: {
            take: 1,
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Retrieves single order by ID or orderNumber with full relationships.
   */
  async getOrderById(idOrNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, images: true, sku: true, stockQuantity: true },
            },
            variant: {
              select: { id: true, name: true, sku: true, stockQuantity: true },
            },
          },
        },
        addressSnapshot: true,
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
        orderNotes: {
          orderBy: { createdAt: 'desc' },
        },
        returnRequests: {
          include: {
            items: true,
            refundRecords: {
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        refundRecords: {
          include: {
            orderReturnRequest: {
              select: { id: true, returnNumber: true, status: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order "${idOrNumber}" not found`);
    }

    let customerNotes = order.notes;
    let schoolPacksSnapshot: any = null;
    if (order.notes && order.notes.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(order.notes);
        if (parsed.schoolPacks) schoolPacksSnapshot = parsed.schoolPacks;
        if (parsed.customerNotes !== undefined) customerNotes = parsed.customerNotes;
      } catch {
        // preserve notes
      }
    }

    const financialSummary = await this.calculateRefundableBalance(this.prisma as any, order);

    return {
      ...order,
      customerNotes,
      schoolPacksSnapshot,
      financialSummary,
    };
  }

  /**
   * Updates order fulfillment status with state machine enforcement and inventory management.
   */
  async updateStatus(
    id: string,
    dto: AdminUpdateStatusDto,
    actor?: { id?: string; name?: string; role?: UserRole }
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
      throw new BadRequestException(
        `Transition from ${order.orderStatus} to ${dto.status} is not permitted.`
      );
    }

    const previousStatus = order.orderStatus;

    const updated = await this.prisma.$transaction(async (tx) => {
      // If cancelling, restore inventory
      if (dto.status === OrderStatus.CANCELLED) {
        const restoreNotePattern = `Restored stock from cancelled order ${order.orderNumber}`;
        const alreadyRestored = await tx.inventoryMovement.findFirst({
          where: { note: { contains: restoreNotePattern } },
        });

        if (!alreadyRestored && order.items && order.items.length > 0) {
          // 1. Collect unique Product and Variant IDs
          const productIds = order.items.map((it) => it.productId).filter(Boolean);
          const variantIds = order.items.map((it) => it.variantId).filter(Boolean) as string[];

          const uniqueSortedProductIds = Array.from(new Set(productIds)).sort();
          const uniqueSortedVariantIds = Array.from(new Set(variantIds)).sort();

          // 2. Deterministic lock acquisition: Products first (ORDER BY id ASC)
          const runningProductStock = new Map<string, number>();
          for (const pId of uniqueSortedProductIds) {
            const lockedProds = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
              SELECT id, "stockQuantity" FROM "Product" WHERE id = ${pId} FOR UPDATE
            `;
            if (lockedProds && lockedProds.length > 0) {
              runningProductStock.set(pId, lockedProds[0].stockQuantity);
            }
          }

          // 3. Deterministic lock acquisition: Variants second (ORDER BY id ASC)
          const runningVariantStock = new Map<string, number>();
          for (const vId of uniqueSortedVariantIds) {
            const lockedVars = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
              SELECT id, "stockQuantity" FROM "ProductVariant" WHERE id = ${vId} FOR UPDATE
            `;
            if (lockedVars && lockedVars.length > 0) {
              runningVariantStock.set(vId, lockedVars[0].stockQuantity);
            }
          }

          // 4. Increment stock and record sequential inventory movements
          for (const item of order.items) {
            const prevProdQty = runningProductStock.get(item.productId) ?? 0;
            const newProdQty = prevProdQty + item.quantity;
            runningProductStock.set(item.productId, newProdQty);

            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });

            if (item.variantId) {
              const prevVarQty = runningVariantStock.get(item.variantId) ?? 0;
              const newVarQty = prevVarQty + item.quantity;
              runningVariantStock.set(item.variantId, newVarQty);

              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stockQuantity: { increment: item.quantity } },
              });
            }

            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                variantId: item.variantId || null,
                previousQuantity: prevProdQty,
                newQuantity: newProdQty,
                changeAmount: item.quantity,
                reason: InventoryChangeReason.RESTOCK,
                note: restoreNotePattern,
                performedById: actor?.id || 'SYSTEM_CANCELLATION',
              },
            });
          }
        }
      }

      // Record Audit Log
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'STATUS_CHANGE',
          fieldChanged: 'orderStatus',
          previousValue: previousStatus,
          newValue: dto.status,
          reason: dto.reason || dto.notes || `Order status updated to ${dto.status}`,
        },
      });

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
          auditLogs: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    this.logger.log(`Order ${order.orderNumber} status changed: ${previousStatus} -> ${dto.status}`);

    // Post-transaction stock broadcast if cancelled
    if (dto.status === OrderStatus.CANCELLED && this.inventoryGateway && order.items) {
      for (const item of order.items) {
        try {
          const p = await this.prisma.product.findUnique({ where: { id: item.productId } });
          if (p) {
            this.inventoryGateway.broadcastStockUpdate({
              productId: p.id,
              variantId: item.variantId || null,
              physicalStock: p.stockQuantity,
              reservedStock: 0,
              availableStock: p.stockQuantity,
              timestamp: new Date().toISOString(),
              reason: 'ORDER_CANCELLED',
            });
          }
        } catch (wsErr) {
          this.logger.error('Error broadcasting post-cancellation stock:', wsErr);
        }
      }
    }

    // Customer Notification
    if (this.notificationsService) {
      this.notificationsService.sendOrderStatusUpdate({
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        status: dto.status,
        trackingNumber: dto.trackingNumber || order.trackingNumber || undefined,
        notes: dto.notes || undefined,
      }).catch((err) => this.logger.error('Failed to dispatch status notification:', err));
    }

    // Real-Time WebSocket Broadcast
    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.status.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.status.updated',
        timestamp: new Date().toISOString(),
        data: {
          previousStatus,
          newStatus: dto.status,
          trackingNumber: dto.trackingNumber || order.trackingNumber,
        },
        actor: { id: actor?.id, name: actor?.name },
      });
    }

    return updated;
  }

  /**
   * Updates order-specific customer contact info without modifying customer user account.
   */
  async updateCustomerInfo(
    id: string,
    dto: AdminUpdateCustomerDto,
    actor?: { id?: string; name?: string }
  ) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }

    const previousData = {
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'CUSTOMER_UPDATE',
          fieldChanged: 'customerDetails',
          previousValue: JSON.stringify(previousData),
          newValue: JSON.stringify({
            customerName: dto.customerName,
            customerEmail: dto.customerEmail,
            customerPhone: dto.customerPhone,
          }),
          reason: dto.reason || 'Staff updated order customer contact information',
        },
      });

      return tx.order.update({
        where: { id },
        data: {
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
        },
        include: {
          addressSnapshot: true,
          items: true,
          auditLogs: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.customer.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.customer.updated',
        timestamp: new Date().toISOString(),
        data: { customerName: dto.customerName, customerEmail: dto.customerEmail, customerPhone: dto.customerPhone },
        actor,
      });
    }

    return updated;
  }

  /**
   * Updates order delivery snapshot.
   */
  async updateDeliveryInfo(
    id: string,
    dto: AdminUpdateDeliveryDto,
    actor?: { id?: string; name?: string }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { addressSnapshot: true },
    });
    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }

    const prevSnapshot = order.addressSnapshot;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'DELIVERY_UPDATE',
          fieldChanged: 'deliveryAddress',
          previousValue: prevSnapshot ? JSON.stringify(prevSnapshot) : 'None',
          newValue: JSON.stringify(dto),
          reason: dto.reason || 'Staff updated order delivery address details',
        },
      });

      const updatedAddress = await tx.orderAddressSnapshot.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          fullName: dto.fullName || order.customerName,
          phone: dto.phone || order.customerPhone,
          email: order.customerEmail,
          addressLine1: dto.addressLine1 || 'N/A',
          addressLine2: dto.addressLine2,
          city: dto.city || 'N/A',
          district: dto.district || 'Colombo',
          postalCode: dto.postalCode,
          province: dto.province,
          deliveryNotes: dto.deliveryNotes,
        },
        update: {
          fullName: dto.fullName !== undefined ? dto.fullName : undefined,
          phone: dto.phone !== undefined ? dto.phone : undefined,
          addressLine1: dto.addressLine1 !== undefined ? dto.addressLine1 : undefined,
          addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2 : undefined,
          city: dto.city !== undefined ? dto.city : undefined,
          district: dto.district !== undefined ? dto.district : undefined,
          postalCode: dto.postalCode !== undefined ? dto.postalCode : undefined,
          province: dto.province !== undefined ? dto.province : undefined,
          deliveryNotes: dto.deliveryNotes !== undefined ? dto.deliveryNotes : undefined,
        },
      });

      return tx.order.findUnique({
        where: { id },
        include: {
          addressSnapshot: true,
          items: true,
          auditLogs: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.delivery.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.delivery.updated',
        timestamp: new Date().toISOString(),
        data: updated?.addressSnapshot,
        actor,
      });
    }

    return updated;
  }

  /**
   * Modifies order items with strict stock availability checking and audit logging.
   */
  async updateOrderItems(
    id: string,
    dto: AdminUpdateItemsDto,
    actor?: { id?: string; name?: string }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }

    if (
      order.orderStatus === OrderStatus.SHIPPED ||
      order.orderStatus === OrderStatus.DELIVERED ||
      order.orderStatus === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot modify items for an order in status ${order.orderStatus}`
      );
    }

    const settings = await this.prisma.storeSettings.findUnique({ where: { id: 'default' } });
    const freeDeliveryThreshold = settings?.freeDeliveryThresholdCents ?? DEFAULT_FREE_DELIVERY_THRESHOLD_CENTS;
    const flatDeliveryFee = settings?.flatDeliveryFeeCents ?? DEFAULT_FLAT_DELIVERY_CENTS;

    const modifiedProductsToBroadcast: string[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Map existing items
      const existingItemsMap = new Map<string, typeof order.items[0]>();
      for (const item of order.items) {
        existingItemsMap.set(`${item.productId}-${item.variantId || ''}`, item);
      }

      const newItemsMap = new Map<string, { productId: string; variantId?: string | null; quantity: number }>();
      for (const item of dto.items) {
        newItemsMap.set(`${item.productId}-${item.variantId || ''}`, item);
      }

      // Check item deletions (items in existing but not in new, or quantity == 0)
      for (const [key, existingItem] of existingItemsMap.entries()) {
        const newItem = newItemsMap.get(key);
        if (!newItem || newItem.quantity === 0) {
          // Restore stock
          await tx.product.update({
            where: { id: existingItem.productId },
            data: { stockQuantity: { increment: existingItem.quantity } },
          });
          if (existingItem.variantId) {
            await tx.productVariant.update({
              where: { id: existingItem.variantId },
              data: { stockQuantity: { increment: existingItem.quantity } },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              productId: existingItem.productId,
              variantId: existingItem.variantId || null,
              previousQuantity: 0,
              newQuantity: existingItem.quantity,
              changeAmount: existingItem.quantity,
              reason: InventoryChangeReason.RESTOCK,
              note: `Removed from order ${order.orderNumber}`,
              performedById: actor?.id || 'STAFF',
            },
          });

          await tx.orderItem.delete({ where: { id: existingItem.id } });
          modifiedProductsToBroadcast.push(existingItem.productId);
        }
      }

      // Check item additions and quantity updates
      for (const itemDto of dto.items) {
        if (itemDto.quantity <= 0) continue;

        const key = `${itemDto.productId}-${itemDto.variantId || ''}`;
        const existing = existingItemsMap.get(key);

        const prod = await tx.product.findUnique({
          where: { id: itemDto.productId },
          include: { variants: true },
        });
        if (!prod) {
          throw new NotFoundException(`Product ${itemDto.productId} not found`);
        }

        const variant = itemDto.variantId
          ? prod.variants.find((v) => v.id === itemDto.variantId)
          : null;

        if (existing) {
          const delta = itemDto.quantity - existing.quantity;
          if (delta > 0) {
            // Need more stock
            const available = variant ? variant.stockQuantity : prod.stockQuantity;
            if (available < delta) {
              throw new BadRequestException(
                `Insufficient stock for "${prod.name}". Requested +${delta}, available: ${available}`
              );
            }

            // Deduct stock
            await tx.product.update({
              where: { id: prod.id },
              data: { stockQuantity: { decrement: delta } },
            });
            if (variant) {
              await tx.productVariant.update({
                where: { id: variant.id },
                data: { stockQuantity: { decrement: delta } },
              });
            }

            await tx.inventoryMovement.create({
              data: {
                productId: prod.id,
                variantId: variant?.id || null,
                previousQuantity: prod.stockQuantity,
                newQuantity: prod.stockQuantity - delta,
                changeAmount: -delta,
                reason: InventoryChangeReason.ORDER_FULFILLMENT,
                note: `Quantity increased in order ${order.orderNumber}`,
                performedById: actor?.id || 'STAFF',
              },
            });
            modifiedProductsToBroadcast.push(prod.id);
          } else if (delta < 0) {
            // Restoring stock
            const returnQty = Math.abs(delta);
            await tx.product.update({
              where: { id: prod.id },
              data: { stockQuantity: { increment: returnQty } },
            });
            if (variant) {
              await tx.productVariant.update({
                where: { id: variant.id },
                data: { stockQuantity: { increment: returnQty } },
              });
            }

            await tx.inventoryMovement.create({
              data: {
                productId: prod.id,
                variantId: variant?.id || null,
                previousQuantity: prod.stockQuantity,
                newQuantity: prod.stockQuantity + returnQty,
                changeAmount: returnQty,
                reason: InventoryChangeReason.RESTOCK,
                note: `Quantity reduced in order ${order.orderNumber}`,
                performedById: actor?.id || 'STAFF',
              },
            });
            modifiedProductsToBroadcast.push(prod.id);
          }

          // Update existing order item
          await tx.orderItem.update({
            where: { id: existing.id },
            data: {
              quantity: itemDto.quantity,
              totalPriceCents: existing.unitPriceCents * itemDto.quantity,
            },
          });
        } else {
          // Brand new item added to order
          const available = variant ? variant.stockQuantity : prod.stockQuantity;
          if (available < itemDto.quantity) {
            throw new BadRequestException(
              `Insufficient stock for "${prod.name}". Requested ${itemDto.quantity}, available: ${available}`
            );
          }

          const unitPriceCents = variant ? variant.priceCents : prod.priceCents;

          await tx.product.update({
            where: { id: prod.id },
            data: { stockQuantity: { decrement: itemDto.quantity } },
          });
          if (variant) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: { stockQuantity: { decrement: itemDto.quantity } },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              productId: prod.id,
              variantId: variant?.id || null,
              previousQuantity: prod.stockQuantity,
              newQuantity: prod.stockQuantity - itemDto.quantity,
              changeAmount: -itemDto.quantity,
              reason: InventoryChangeReason.ORDER_FULFILLMENT,
              note: `Added to order ${order.orderNumber}`,
              performedById: actor?.id || 'STAFF',
            },
          });

          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: prod.id,
              variantId: variant?.id || null,
              productName: prod.name,
              variantName: variant?.name || null,
              sku: variant?.sku || prod.sku,
              unitPriceCents,
              quantity: itemDto.quantity,
              totalPriceCents: unitPriceCents * itemDto.quantity,
            },
          });
          modifiedProductsToBroadcast.push(prod.id);
        }
      }

      // Re-fetch items to recalculate totals
      const refreshedItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const newSubtotalCents = refreshedItems.reduce((acc, it) => acc + it.totalPriceCents, 0);

      // Recalculate delivery fee
      const newDeliveryCents = newSubtotalCents >= freeDeliveryThreshold ? 0 : flatDeliveryFee;
      const newTotalCents = Math.max(0, newSubtotalCents - order.discountCents + newDeliveryCents);

      // Record Audit Log
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'ITEMS_UPDATE',
          fieldChanged: 'orderItems',
          previousValue: `Subtotal: ${order.subtotalCents}, Total: ${order.totalCents}`,
          newValue: `Subtotal: ${newSubtotalCents}, Total: ${newTotalCents}`,
          reason: dto.reason || 'Staff adjusted order item line items or quantities',
        },
      });

      return tx.order.update({
        where: { id },
        data: {
          subtotalCents: newSubtotalCents,
          deliveryCents: newDeliveryCents,
          totalCents: newTotalCents,
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, images: true, sku: true, stockQuantity: true },
              },
            },
          },
          addressSnapshot: true,
          auditLogs: { orderBy: { createdAt: 'desc' } },
        },
      });
    });

    // Broadcast stock updates
    if (this.inventoryGateway) {
      for (const pId of Array.from(new Set(modifiedProductsToBroadcast))) {
        try {
          const p = await this.prisma.product.findUnique({ where: { id: pId } });
          if (p) {
            this.inventoryGateway.broadcastStockUpdate({
              productId: p.id,
              physicalStock: p.stockQuantity,
              reservedStock: 0,
              availableStock: p.stockQuantity,
              timestamp: new Date().toISOString(),
              reason: 'ORDER_ITEMS_UPDATED',
            });
          }
        } catch (wsErr) {
          this.logger.error('Error broadcasting stock update:', wsErr);
        }
      }
    }

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.items.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.items.updated',
        timestamp: new Date().toISOString(),
        data: { items: updated.items, subtotalCents: updated.subtotalCents, totalCents: updated.totalCents },
        actor,
      });
    }

    return updated;
  }

  /**
   * Cancels order with explicit inventory restoration and optional refund recording.
   */
  async cancelOrder(
    id: string,
    dto: AdminCancelOrderDto,
    actor?: { id?: string; name?: string }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order "${id}" not found`);
    }

    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException(`Order ${order.orderNumber} is already cancelled`);
    }

    if (order.orderStatus === OrderStatus.DELIVERED) {
      throw new BadRequestException(`Delivered order ${order.orderNumber} cannot be cancelled; please create a return request instead.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 0. Deterministic lock acquisition: Order row FIRST
      const lockedOrders = await tx.$queryRaw<Array<{
        id: string;
        orderNumber: string;
        totalCents: number;
        paymentMethod: PaymentMethod;
        paymentStatus: PaymentStatus;
        orderStatus: OrderStatus;
        notes: string | null;
        customerEmail: string;
        customerName: string;
      }>>`
        SELECT id, "orderNumber", "totalCents", "paymentMethod", "paymentStatus", "orderStatus", "notes", "customerEmail", "customerName"
        FROM "Order" WHERE id = ${id} FOR UPDATE
      `;
      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundException(`Order "${id}" not found`);
      }
      const lockedOrder = lockedOrders[0];

      if (lockedOrder.orderStatus === OrderStatus.CANCELLED) {
        throw new BadRequestException(`Order ${lockedOrder.orderNumber} is already cancelled`);
      }

      if (lockedOrder.orderStatus === OrderStatus.DELIVERED) {
        throw new BadRequestException(`Delivered order ${lockedOrder.orderNumber} cannot be cancelled; please create a return request instead.`);
      }

      // Restore inventory if requested and not previously restored
      if (dto.restoreInventory && order.items && order.items.length > 0) {
        // 1. Collect unique Product and Variant IDs
        const productIds = order.items.map((it) => it.productId).filter(Boolean);
        const variantIds = order.items.map((it) => it.variantId).filter(Boolean) as string[];

        const uniqueSortedProductIds = Array.from(new Set(productIds)).sort();
        const uniqueSortedVariantIds = Array.from(new Set(variantIds)).sort();

        // 2. Deterministic lock acquisition: Products first (ORDER BY id ASC)
        const runningProductStock = new Map<string, number>();
        for (const pId of uniqueSortedProductIds) {
          const lockedProds = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
            SELECT id, "stockQuantity" FROM "Product" WHERE id = ${pId} FOR UPDATE
          `;
          if (lockedProds && lockedProds.length > 0) {
            runningProductStock.set(pId, lockedProds[0].stockQuantity);
          }
        }

        // 3. Deterministic lock acquisition: Variants second (ORDER BY id ASC)
        const runningVariantStock = new Map<string, number>();
        for (const vId of uniqueSortedVariantIds) {
          const lockedVars = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
            SELECT id, "stockQuantity" FROM "ProductVariant" WHERE id = ${vId} FOR UPDATE
          `;
          if (lockedVars && lockedVars.length > 0) {
            runningVariantStock.set(vId, lockedVars[0].stockQuantity);
          }
        }

        // 4. Increment stock and record sequential inventory movements
        for (const item of order.items) {
          const prevProdQty = runningProductStock.get(item.productId) ?? 0;
          const newProdQty = prevProdQty + item.quantity;
          runningProductStock.set(item.productId, newProdQty);

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });

          if (item.variantId) {
            const prevVarQty = runningVariantStock.get(item.variantId) ?? 0;
            const newVarQty = prevVarQty + item.quantity;
            runningVariantStock.set(item.variantId, newVarQty);

            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId || null,
              previousQuantity: prevProdQty,
              newQuantity: newProdQty,
              changeAmount: item.quantity,
              reason: InventoryChangeReason.RESTOCK,
              note: `Restored stock from cancelled order ${lockedOrder.orderNumber}`,
              performedById: actor?.id || 'STAFF',
            },
          });
        }
      }

      // Handle cancellation refund if requested
      if (dto.processRefund) {
        if (!actor?.id || !actor.id.trim()) {
          throw new BadRequestException('Authenticated admin identity is required to cancel an order with refund.');
        }

        if (lockedOrder.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
          throw new BadRequestException(
            'Cannot process cancellation refund: Cash on Delivery orders cannot be refunded without verified courier remittance.'
          );
        }
        if (lockedOrder.paymentMethod === PaymentMethod.KOKO_BNPL) {
          throw new BadRequestException(
            'Cannot process cancellation refund: Koko BNPL gateway refund integration is not implemented.'
          );
        }

        const bal = await this.calculateRefundableBalance(tx, lockedOrder);
        if (bal.verifiedCollectedCents === 0) {
          throw new BadRequestException(
            `Cannot process cancellation refund: No verified payment collection exists for order ${lockedOrder.orderNumber}.`
          );
        }

        if (bal.availableRefundBalanceCents <= 0) {
          throw new BadRequestException(
            `Cannot process cancellation refund: No remaining refundable balance exists for order ${lockedOrder.orderNumber}.`
          );
        }

        const cancelRefundPayload = {
          amountCents: bal.availableRefundBalanceCents,
          method: lockedOrder.paymentMethod,
          reason: `Cancellation refund: ${dto.reason}`,
        };

        await tx.refundRecord.create({
          data: {
            orderId: lockedOrder.id,
            amountCents: bal.availableRefundBalanceCents,
            currency: 'LKR',
            method: lockedOrder.paymentMethod,
            status: RefundStatus.REQUESTED,
            reference: `REF-CANC-${lockedOrder.orderNumber}`,
            reason: `Cancellation refund: ${dto.reason}`,
            processedBy: actor.name || 'Staff',
            processedById: actor.id,
            requestedById: actor.id,
            idempotencyKey: `cancel-${lockedOrder.id}`,
            payloadHash: this.computeRefundPayloadHash(cancelRefundPayload),
          },
        });
      }

      // Record Audit Log
      await tx.orderAuditLog.create({
        data: {
          orderId: lockedOrder.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'ORDER_CANCELLED',
          fieldChanged: 'orderStatus',
          previousValue: lockedOrder.orderStatus,
          newValue: OrderStatus.CANCELLED,
          reason: dto.reason,
        },
      });

      return tx.order.update({
        where: { id },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          notes: lockedOrder.notes ? `${lockedOrder.notes} | [Cancelled: ${dto.reason}]` : `[Cancelled: ${dto.reason}]`,
        },
        include: {
          items: true,
          addressSnapshot: true,
          auditLogs: { orderBy: { createdAt: 'desc' } },
          refundRecords: true,
        },
      });
    });

    // Notify customer
    if (this.notificationsService) {
      this.notificationsService.sendPaymentOutcome({
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        status: 'CANCELLED',
        amountCents: order.totalCents,
        reason: dto.reason,
      }).catch((err) => this.logger.error('Failed to dispatch cancellation notice:', err));
    }

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.cancelled', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.cancelled',
        timestamp: new Date().toISOString(),
        data: { reason: dto.reason, status: OrderStatus.CANCELLED },
        actor,
      });
    }

    return updated;
  }

  /**
   * Retrieves return requests for an order.
   */
  async getOrderReturns(orderId: string) {
    return this.prisma.orderReturnRequest.findMany({
      where: { orderId },
      include: {
        items: true,
        refundRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a formal return request.
   */
  async createReturnRequest(
    orderId: string,
    dto: AdminCreateReturnDto,
    actor?: { id?: string; name?: string }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }

    if (order.orderStatus !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        `Returns can only be requested for orders with DELIVERED status. Order ${order.orderNumber} is currently in status "${order.orderStatus}".`
      );
    }

    const returnNumber = `RET-${order.orderNumber}-${Date.now().toString().slice(-4)}`;

    const returnReq = await this.prisma.$transaction(async (tx) => {
      // 1. Acquire an exclusive row-level lock on the parent Order row.
      // This serializes return quantity validation and creation for the same order across concurrent connections.
      const lockedOrders = await tx.$queryRaw<Array<{ id: string; orderStatus: OrderStatus }>>`
        SELECT id, "orderStatus" FROM "Order" WHERE id = ${order.id} FOR UPDATE
      `;
      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundException(`Order "${orderId}" not found`);
      }

      const lockedOrder = lockedOrders[0];
      if (lockedOrder.orderStatus !== OrderStatus.DELIVERED) {
        throw new BadRequestException(
          `Returns can only be requested for orders with DELIVERED status. Order ${order.orderNumber} is currently in status "${lockedOrder.orderStatus}".`
        );
      }

      // Re-fetch order items inside transaction to ensure fresh order items state
      const fetchedItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      });
      const orderItems = (fetchedItems && fetchedItems.length > 0) ? fetchedItems : (order.items || []);

      // Find all existing return requests for this order that are not REJECTED (under the acquired lock)
      const existingReturns = await tx.orderReturnRequest.findMany({
        where: {
          orderId: order.id,
          status: { in: [ReturnStatus.PENDING, ReturnStatus.APPROVED, ReturnStatus.COMPLETED] },
        },
        include: { items: true },
      });

      for (const it of dto.items) {
        const matched = orderItems.find((oi) => oi.id === it.orderItemId);
        if (!matched) {
          throw new BadRequestException(
            `Order item "${it.orderItemId}" not found in order ${order.orderNumber}.`
          );
        }

        const previouslyReturnedQty = existingReturns
          .flatMap((r) => r.items)
          .filter((ri) => ri.orderItemId === it.orderItemId)
          .reduce((sum, ri) => sum + ri.quantity, 0);

        const remainingEligibleQty = matched.quantity - previouslyReturnedQty;
        if (it.quantity > remainingEligibleQty) {
          throw new BadRequestException(
            `Cannot return ${it.quantity} unit(s) of "${matched.productName}". Only ${remainingEligibleQty} eligible unit(s) remaining (ordered: ${matched.quantity}, already requested/returned: ${previouslyReturnedQty}).`
          );
        }
      }

      const created = await tx.orderReturnRequest.create({
        data: {
          orderId: order.id,
          returnNumber,
          status: ReturnStatus.PENDING,
          reason: dto.reason,
          items: {
            create: dto.items.map((it) => {
              const matched = orderItems.find((oi) => oi.id === it.orderItemId);
              return {
                orderItemId: it.orderItemId,
                productName: matched?.productName || 'Order Product',
                quantity: it.quantity,
                reason: it.reason,
                status: ReturnItemStatus.PENDING,
              };
            }),
          },
        },
        include: { items: true },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'RETURN_REQUEST_CREATED',
          fieldChanged: 'returnRequests',
          newValue: returnNumber,
          reason: dto.reason,
        },
      });

      return created;
    });

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.return.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.return.updated',
        timestamp: new Date().toISOString(),
        data: returnReq,
        actor,
      });
    }

    return returnReq;
  }

  /**
   * Processes return request decision (APPROVE, REJECT, CONFIRM_RECEIVED).
   */
  async processReturnStatus(
    orderId: string,
    returnId: string,
    dto: AdminProcessReturnDto,
    actor?: { id?: string; name?: string }
  ) {
    const returnReq = await this.prisma.orderReturnRequest.findUnique({
      where: { id: returnId },
      include: { items: true, order: true },
    });
    if (!returnReq || returnReq.orderId !== orderId) {
      throw new NotFoundException(`Return request "${returnId}" not found for this order`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Enforce return state machine transitions
      const current = await tx.orderReturnRequest.findUnique({
        where: { id: returnId },
        include: { items: true, order: true },
      });
      if (!current || current.orderId !== orderId) {
        throw new NotFoundException(`Return request "${returnId}" not found for this order`);
      }

      if (current.status === ReturnStatus.COMPLETED) {
        throw new BadRequestException(
          `Return request "${current.returnNumber}" has already been completed and cannot be processed again.`
        );
      }
      if (current.status === ReturnStatus.REJECTED) {
        throw new BadRequestException(
          `Return request "${current.returnNumber}" has already been rejected and cannot be modified.`
        );
      }

      let expectedStatus: ReturnStatus;
      let targetStatus: ReturnStatus;
      let itemStatus: ReturnItemStatus;

      if (dto.action === 'APPROVE') {
        if (current.status !== ReturnStatus.PENDING) {
          throw new BadRequestException(
            `Cannot approve return request in status "${current.status}". Only PENDING requests can be approved.`
          );
        }
        expectedStatus = ReturnStatus.PENDING;
        targetStatus = ReturnStatus.APPROVED;
        itemStatus = ReturnItemStatus.APPROVED;
      } else if (dto.action === 'REJECT') {
        if (current.status !== ReturnStatus.PENDING) {
          throw new BadRequestException(
            `Cannot reject return request in status "${current.status}". Only PENDING requests can be rejected.`
          );
        }
        expectedStatus = ReturnStatus.PENDING;
        targetStatus = ReturnStatus.REJECTED;
        itemStatus = ReturnItemStatus.REJECTED;
      } else if (dto.action === 'CONFIRM_RECEIVED') {
        if (current.status !== ReturnStatus.APPROVED) {
          throw new BadRequestException(
            `Return request "${current.returnNumber}" must be in APPROVED status before confirming receipt. Current status: ${current.status}.`
          );
        }
        expectedStatus = ReturnStatus.APPROVED;
        targetStatus = ReturnStatus.COMPLETED;
        itemStatus = ReturnItemStatus.RECEIVED;
      } else {
        throw new BadRequestException(`Unsupported return action "${(dto as any).action}".`);
      }

      // 2. Concurrency-safe atomic conditional update to claim this state transition
      const atomicClaim = await tx.orderReturnRequest.updateMany({
        where: {
          id: returnId,
          orderId,
          status: expectedStatus,
        },
        data: {
          status: targetStatus,
          rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : current.rejectionReason,
        },
      });

      if (atomicClaim.count === 0) {
        const fresh = await tx.orderReturnRequest.findUnique({ where: { id: returnId } });
        if (fresh?.status === ReturnStatus.COMPLETED) {
          throw new BadRequestException(
            `Return request "${current.returnNumber}" has already been completed and cannot be processed again.`
          );
        }
        if (fresh?.status === ReturnStatus.REJECTED) {
          throw new BadRequestException(
            `Return request "${current.returnNumber}" has already been rejected and cannot be modified.`
          );
        }
        throw new BadRequestException(
          `Invalid return status transition. Return "${current.returnNumber}" is currently in status "${fresh?.status}".`
        );
      }

      // 3. Update return items
      await tx.orderReturnItem.updateMany({
        where: { returnRequestId: current.id },
        data: {
          status: itemStatus,
          rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : null,
          receivedAt: dto.action === 'CONFIRM_RECEIVED' ? new Date() : null,
        },
      });

      // 4. Restock inventory if and only if restockItems is true
      if (dto.action === 'CONFIRM_RECEIVED' && dto.restockItems) {
        // Filter items that have not yet been received
        const restockableItems = current.items.filter((it) => !it.receivedAt);
        if (restockableItems.length > 0) {
          // 1. Fetch order items for these return items
          const orderItemIds = Array.from(new Set(restockableItems.map((it) => it.orderItemId)));
          let orderItems = await tx.orderItem.findMany({
            where: { id: { in: orderItemIds } },
          });
          if (!orderItems || orderItems.length === 0) {
            orderItems = [];
            for (const oiId of orderItemIds) {
              const oi = await tx.orderItem.findUnique({ where: { id: oiId } });
              if (oi) orderItems.push(oi);
            }
          }
          const orderItemMap = new Map(orderItems.map((oi) => [oi.id, oi]));

          // 2. Collect unique Product IDs and Variant IDs
          const productIds: string[] = [];
          const variantIds: string[] = [];
          for (const retItem of restockableItems) {
            const oi = orderItemMap.get(retItem.orderItemId);
            if (oi) {
              if (oi.productId) productIds.push(oi.productId);
              if (oi.variantId) variantIds.push(oi.variantId);
            }
          }

          const uniqueSortedProductIds = Array.from(new Set(productIds)).sort();
          const uniqueSortedVariantIds = Array.from(new Set(variantIds)).sort();

          // 3. Acquire Product locks in deterministic ascending order
          const runningProductStock = new Map<string, number>();
          for (const pId of uniqueSortedProductIds) {
            const lockedProds = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
              SELECT id, "stockQuantity" FROM "Product" WHERE id = ${pId} FOR UPDATE
            `;
            if (lockedProds && lockedProds.length > 0) {
              runningProductStock.set(pId, lockedProds[0].stockQuantity);
            }
          }

          // 4. Acquire ProductVariant locks in deterministic ascending order
          const runningVariantStock = new Map<string, number>();
          for (const vId of uniqueSortedVariantIds) {
            const lockedVars = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
              SELECT id, "stockQuantity" FROM "ProductVariant" WHERE id = ${vId} FOR UPDATE
            `;
            if (lockedVars && lockedVars.length > 0) {
              runningVariantStock.set(vId, lockedVars[0].stockQuantity);
            }
          }

          // 5. Apply increments and create movements
          for (const item of restockableItems) {
            const orderItem = orderItemMap.get(item.orderItemId);
            if (!orderItem) continue;

            const prevProdQty = runningProductStock.get(orderItem.productId) ?? 0;
            const newProdQty = prevProdQty + item.quantity;
            runningProductStock.set(orderItem.productId, newProdQty);

            await tx.product.update({
              where: { id: orderItem.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });

            if (orderItem.variantId) {
              const prevVarQty = runningVariantStock.get(orderItem.variantId) ?? 0;
              const newVarQty = prevVarQty + item.quantity;
              runningVariantStock.set(orderItem.variantId, newVarQty);

              await tx.productVariant.update({
                where: { id: orderItem.variantId },
                data: { stockQuantity: { increment: item.quantity } },
              });
            }

            await tx.inventoryMovement.create({
              data: {
                productId: orderItem.productId,
                variantId: orderItem.variantId || null,
                previousQuantity: prevProdQty,
                newQuantity: newProdQty,
                changeAmount: item.quantity,
                reason: InventoryChangeReason.RESTOCK,
                note: `Restocked from Return ${current.returnNumber}`,
                performedById: actor?.id || 'STAFF',
              },
            });
          }
        }
      }

      const res = await tx.orderReturnRequest.update({
        where: { id: current.id },
        data: {
          status: targetStatus,
          rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : current.rejectionReason,
        },
        include: { items: true },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'RETURN_DECISION',
          fieldChanged: 'returnStatus',
          previousValue: current.status,
          newValue: targetStatus,
          reason: dto.action === 'REJECT' ? dto.rejectionReason : `Staff executed return action ${dto.action}`,
        },
      });

      return res!;
    });

    if (this.notificationsService && returnReq.order) {
      this.notificationsService.sendReturnStatusUpdate({
        orderNumber: returnReq.order.orderNumber,
        customerEmail: returnReq.order.customerEmail,
        customerName: returnReq.order.customerName,
        returnNumber: returnReq.returnNumber,
        status: updated.status,
        rejectionReason: dto.rejectionReason,
      }).catch((err) => this.logger.error('Failed to dispatch return notification:', err));
    }

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.return.updated', {
        orderId,
        orderNumber: returnReq.order.orderNumber,
        event: 'order.return.updated',
        timestamp: new Date().toISOString(),
        data: updated,
        actor,
      });
    }

    return updated;
  }

  /**
   * Authoritative calculation of verified collected funds, reserved refunds, and available balance.
   */
  async calculateRefundableBalance(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      totalCents: number;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
    }
  ) {
    let verifiedCollectedCents = 0;

    if (order.paymentMethod === PaymentMethod.CARD_PAYHERE) {
      const attempts = await tx.paymentAttempt.findMany({
        where: {
          orderId: order.id,
          status: PaymentAttemptStatus.SUCCEEDED,
          gatewayReference: { not: null },
        },
        select: {
          amountCents: true,
          gatewayReference: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const seenRefs = new Set<string>();
      for (const att of attempts) {
        const ref = att.gatewayReference?.trim();
        if (ref && !seenRefs.has(ref)) {
          seenRefs.add(ref);
          verifiedCollectedCents += att.amountCents;
        }
      }
    } else if (order.paymentMethod === PaymentMethod.BANK_TRANSFER) {
      // A bank transfer contributes zero verified collected funds unless an authorized verification
      // process has recorded a valid deposit transaction reference in PaymentAttempt.gatewayReference
      const attempts = await tx.paymentAttempt.findMany({
        where: {
          orderId: order.id,
          status: PaymentAttemptStatus.SUCCEEDED,
          gatewayReference: { not: null },
        },
        select: {
          amountCents: true,
          gatewayReference: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const seenRefs = new Set<string>();
      for (const att of attempts) {
        const ref = att.gatewayReference?.trim();
        if (ref && !seenRefs.has(ref)) {
          seenRefs.add(ref);
          verifiedCollectedCents += att.amountCents;
        }
      }
    } else if (order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
      // COD refunds are strictly blocked until courier remittance reconciliation exists
      verifiedCollectedCents = 0;
    } else if (order.paymentMethod === PaymentMethod.KOKO_BNPL) {
      // Koko refunds are strictly blocked
      verifiedCollectedCents = 0;
    }

    const eligibleRefundBaseCents = Math.min(order.totalCents, verifiedCollectedCents);

    const completedAggregate = await tx.refundRecord.aggregate({
      where: {
        orderId: order.id,
        status: RefundStatus.COMPLETED,
      },
      _sum: { amountCents: true },
    });
    const completedRefundsCents = completedAggregate._sum.amountCents ?? 0;

    const reservedAggregate = await tx.refundRecord.aggregate({
      where: {
        orderId: order.id,
        status: { in: [RefundStatus.REQUESTED, RefundStatus.APPROVED, RefundStatus.PROCESSING] },
      },
      _sum: { amountCents: true },
    });
    const reservedRefundsCents = reservedAggregate._sum.amountCents ?? 0;

    const availableRefundBalanceCents = Math.max(
      0,
      eligibleRefundBaseCents - completedRefundsCents - reservedRefundsCents
    );

    return {
      verifiedCollectedCents,
      eligibleRefundBaseCents,
      completedRefundsCents,
      reservedRefundsCents,
      availableRefundBalanceCents,
    };
  }

  private computeRefundPayloadHash(dto: {
    amountCents: number;
    method: string;
    reason: string;
    orderReturnRequestId?: string | null;
  }): string {
    const canonical = JSON.stringify({
      amountCents: dto.amountCents,
      method: dto.method.trim().toUpperCase(),
      orderReturnRequestId: dto.orderReturnRequestId || null,
      reason: dto.reason.trim(),
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Retrieves all refunds and financial calculation summary for an order.
   */
  async getOrderRefunds(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        refundRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }

    const bal = await this.calculateRefundableBalance(this.prisma as any, order);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderTotalCents: order.totalCents,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      ...bal,
      refundRecords: order.refundRecords,
    };
  }

  /**
   * Processes manual or verified refund request recording with strict row locking and validation.
   */
  async processRefund(
    orderId: string,
    dto: AdminProcessRefundDto,
    actor?: { id?: string; name?: string }
  ) {
    if (!actor?.id || !actor.id.trim()) {
      throw new BadRequestException('Authenticated admin identity is required to request a refund.');
    }

    if (!Number.isInteger(dto.amountCents) || dto.amountCents <= 0) {
      throw new BadRequestException('Refund amount must be a positive integer in cents.');
    }

    const incomingHash = this.computeRefundPayloadHash(dto);

    const refund = await this.prisma.$transaction(async (tx) => {
      // 1. Acquire Order row lock FIRST using SELECT ... FOR UPDATE
      const lockedOrders = await tx.$queryRaw<Array<{
        id: string;
        orderNumber: string;
        totalCents: number;
        paymentMethod: PaymentMethod;
        paymentStatus: PaymentStatus;
        orderStatus: OrderStatus;
        customerEmail: string;
        customerName: string;
      }>>`
        SELECT id, "orderNumber", "totalCents", "paymentMethod", "paymentStatus", "orderStatus", "customerEmail", "customerName"
        FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;

      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundException(`Order "${orderId}" not found`);
      }
      const order = lockedOrders[0];

      // 2. Reject unsupported methods
      if (order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
        throw new BadRequestException(
          'Cash on Delivery refunds are blocked because cash collection cannot be verified without courier remittance records.'
        );
      }
      if (order.paymentMethod === PaymentMethod.KOKO_BNPL) {
        throw new BadRequestException(
          'Koko BNPL refunds are currently blocked because Koko gateway integration is not implemented.'
        );
      }

      // 3. Idempotency Check inside lock
      if (dto.idempotencyKey) {
        const existing = await tx.refundRecord.findUnique({
          where: {
            orderId_idempotencyKey: {
              orderId: order.id,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });

        if (existing) {
          if (existing.payloadHash && existing.payloadHash === incomingHash) {
            // Idempotent replay: return existing record without double-reservation
            return {
              refund: existing,
              orderNumber: order.orderNumber,
            };
          } else {
            throw new ConflictException(
              `Idempotency key "${dto.idempotencyKey}" has already been used with a different refund payload on this order.`
            );
          }
        }
      }

      // 3b. Validate linked Return Request if specified
      if (dto.orderReturnRequestId) {
        const returnReq = await tx.orderReturnRequest.findUnique({
          where: { id: dto.orderReturnRequestId },
          include: { items: true },
        });

        if (!returnReq || returnReq.orderId !== order.id) {
          throw new BadRequestException(
            `Return request "${dto.orderReturnRequestId}" not found for order ${order.orderNumber}.`
          );
        }

        if (returnReq.status === ReturnStatus.REJECTED) {
          throw new BadRequestException(
            `Cannot process refund for return request "${returnReq.returnNumber}" because it was rejected.`
          );
        }

        if (returnReq.status === ReturnStatus.PENDING) {
          throw new BadRequestException(
            `Cannot process refund for return request "${returnReq.returnNumber}" because it is still PENDING. Only APPROVED or COMPLETED returns can be refunded.`
          );
        }

        const existingReturnRefund = await tx.refundRecord.findFirst({
          where: {
            orderReturnRequestId: returnReq.id,
            status: {
              in: [
                RefundStatus.REQUESTED,
                RefundStatus.APPROVED,
                RefundStatus.PROCESSING,
                RefundStatus.COMPLETED,
              ],
            },
          },
        });

        if (existingReturnRefund) {
          throw new BadRequestException(
            `Return request "${returnReq.returnNumber}" already has an active or completed refund (${existingReturnRefund.id}). A return cannot be refunded more than once.`
          );
        }
      }

      // 4. Calculate Authoritative Refundable Balance
      const bal = await this.calculateRefundableBalance(tx, order);

      if (order.paymentMethod === PaymentMethod.BANK_TRANSFER && bal.verifiedCollectedCents === 0) {
        throw new BadRequestException(
          'Bank transfer refund cannot be authorized because no verified deposit reference exists for this order.'
        );
      }

      if (bal.verifiedCollectedCents === 0) {
        throw new BadRequestException(
          `Refund rejected: No verified collected payment exists for order ${order.orderNumber}.`
        );
      }

      if (dto.amountCents > bal.availableRefundBalanceCents) {
        throw new BadRequestException(
          `Refund amount (Rs. ${(dto.amountCents / 100).toFixed(2)}) exceeds available refundable balance (Rs. ${(bal.availableRefundBalanceCents / 100).toFixed(2)}).`
        );
      }

      // 5. Create RefundRecord in REQUESTED status (reserving balance)
      const created = await tx.refundRecord.create({
        data: {
          orderId: order.id,
          amountCents: dto.amountCents,
          currency: 'LKR',
          method: dto.method,
          status: RefundStatus.REQUESTED,
          reference: dto.reference || `REF-${Date.now()}`,
          idempotencyKey: dto.idempotencyKey || null,
          payloadHash: incomingHash,
          reason: dto.reason,
          maskedAccountNumber: dto.maskedAccountNumber || null,
          processedBy: actor.name || 'Staff',
          processedById: actor.id,
          requestedById: actor.id,
          orderReturnRequestId: dto.orderReturnRequestId || null,
        },
      });

      // 6. Record Audit Log
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor.id,
          adminName: actor.name || 'Staff Administrator',
          action: 'REFUND_REQUESTED',
          fieldChanged: 'refundStatus',
          previousValue: 'NONE',
          newValue: RefundStatus.REQUESTED,
          reason: `Refund requested: Rs. ${(dto.amountCents / 100).toFixed(2)} via ${dto.method}. Reason: ${dto.reason}`,
        },
      });

      return {
        refund: created,
        orderNumber: order.orderNumber,
      };
    });

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.refund.updated', {
        orderId,
        orderNumber: refund.orderNumber,
        event: 'order.refund.updated',
        timestamp: new Date().toISOString(),
        data: refund.refund,
        actor,
      });
    }

    return refund.refund;
  }

  /**
   * Approves a requested refund.
   */
  async approveRefund(
    orderId: string,
    refundId: string,
    dto: AdminApproveRefundDto,
    actor?: { id?: string; name?: string }
  ) {
    if (!actor?.id || !actor.id.trim()) {
      throw new BadRequestException('Authenticated admin identity is required to approve a refund.');
    }

    return this.prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{ id: string; orderNumber: string }>>`
        SELECT id, "orderNumber" FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;
      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundException(`Order "${orderId}" not found`);
      }

      const refund = await tx.refundRecord.findUnique({
        where: { id: refundId },
      });
      if (!refund || refund.orderId !== orderId) {
        throw new NotFoundException(`Refund "${refundId}" not found for order "${orderId}"`);
      }

      // Legacy or untracked requester identity guard
      if (!refund.requestedById) {
        throw new BadRequestException(
          `Legacy or untracked refund "${refundId}" cannot be approved without verifiable requester identity. Manual review is required.`
        );
      }

      // Segregation of duties: requester cannot approve their own refund
      if (actor.id === refund.requestedById) {
        throw new ForbiddenException(
          `Segregation of duties violation: The original refund requester (${actor.id}) cannot approve their own refund request.`
        );
      }

      if (refund.status !== RefundStatus.REQUESTED) {
        throw new BadRequestException(
          `Invalid state transition: Cannot approve refund with current status "${refund.status}". Only REQUESTED refunds can be approved.`
        );
      }

      const updated = await tx.refundRecord.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.APPROVED,
          approvedById: actor.id,
          approvedAt: new Date(),
        },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId,
          adminId: actor.id,
          adminName: actor.name || 'Staff Administrator',
          action: 'REFUND_APPROVED',
          fieldChanged: 'refundStatus',
          previousValue: RefundStatus.REQUESTED,
          newValue: RefundStatus.APPROVED,
          reason: `Refund approved by ${actor.name || actor.id}. Requester: ${refund.requestedById}. ${dto.notes || ''}`.trim(),
        },
      });

      if (this.ordersGateway) {
        this.ordersGateway.broadcastOrderEvent('order.refund.updated', {
          orderId,
          orderNumber: lockedOrders[0].orderNumber,
          event: 'order.refund.updated',
          timestamp: new Date().toISOString(),
          data: updated,
          actor,
        });
      }

      return updated;
    });
  }

  /**
   * Transitions refund to PROCESSING status.
   */
  async processRefundExecution(
    orderId: string,
    refundId: string,
    dto: AdminProcessRefundExecutionDto,
    actor?: { id?: string; name?: string }
  ) {
    if (!actor?.id || !actor.id.trim()) {
      throw new BadRequestException('Authenticated admin identity is required to process refund execution.');
    }

    return this.prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{ id: string; orderNumber: string }>>`
        SELECT id, "orderNumber" FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;
      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundException(`Order "${orderId}" not found`);
      }

      const refund = await tx.refundRecord.findUnique({
        where: { id: refundId },
      });
      if (!refund || refund.orderId !== orderId) {
        throw new NotFoundException(`Refund "${refundId}" not found for order "${orderId}"`);
      }

      if (refund.status !== RefundStatus.APPROVED) {
        throw new BadRequestException(
          `Invalid state transition: Cannot mark refund processing with current status "${refund.status}". Only APPROVED refunds can be transitioned to PROCESSING.`
        );
      }

      const updated = await tx.refundRecord.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.PROCESSING,
        },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId,
          adminId: actor.id,
          adminName: actor.name || 'Staff Administrator',
          action: 'REFUND_PROCESSING',
          fieldChanged: 'refundStatus',
          previousValue: RefundStatus.APPROVED,
          newValue: RefundStatus.PROCESSING,
          reason: `Refund submitted for execution by ${actor.name || actor.id}. Approver: ${refund.approvedById || 'N/A'}. ${dto.notes || ''}`.trim(),
        },
      });

      if (this.ordersGateway) {
        this.ordersGateway.broadcastOrderEvent('order.refund.updated', {
          orderId,
          orderNumber: lockedOrders[0].orderNumber,
          event: 'order.refund.updated',
          timestamp: new Date().toISOString(),
          data: updated,
          actor,
        });
      }

      return updated;
    });
  }

  /**
   * Completes a refund upon verified external execution evidence.
   */
  async completeRefund(
    orderId: string,
    refundId: string,
    dto: AdminCompleteRefundDto,
    actor?: { id?: string; name?: string }
  ) {
    if (!actor?.id || !actor.id.trim()) {
      throw new BadRequestException('Authenticated admin identity is required to complete a refund.');
    }

    if (!dto.externalReference || !dto.externalReference.trim()) {
      throw new BadRequestException('External transaction reference is required to complete a refund.');
    }

    return this.prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{
        id: string;
        orderNumber: string;
        totalCents: number;
        paymentStatus: PaymentStatus;
        customerEmail: string;
        customerName: string;
      }>>`
        SELECT id, "orderNumber", "totalCents", "paymentStatus", "customerEmail", "customerName"
        FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;
      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundException(`Order "${orderId}" not found`);
      }
      const order = lockedOrders[0];

      const refund = await tx.refundRecord.findUnique({
        where: { id: refundId },
      });
      if (!refund || refund.orderId !== orderId) {
        throw new NotFoundException(`Refund "${refundId}" not found for order "${orderId}"`);
      }

      // Legacy or untracked requester identity guard
      if (!refund.requestedById) {
        throw new BadRequestException(
          `Legacy or untracked refund "${refundId}" cannot be completed without verifiable requester identity. Manual review is required.`
        );
      }

      // Segregation of duties: requester cannot complete their own refund
      if (actor.id === refund.requestedById) {
        throw new ForbiddenException(
          `Segregation of duties violation: The original refund requester (${actor.id}) cannot complete their own refund.`
        );
      }

      if (refund.status !== RefundStatus.PROCESSING) {
        throw new BadRequestException(
          `Invalid state transition: Cannot mark refund completed with current status "${refund.status}". Only PROCESSING refunds can be completed with execution evidence.`
        );
      }

      const updatedRefund = await tx.refundRecord.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.COMPLETED,
          externalReference: dto.externalReference.trim(),
          completedById: actor.id,
          completedAt: new Date(),
        },
      });

      // If refund is linked to a return request, mark associated return items as REFUNDED
      if (refund.orderReturnRequestId) {
        await tx.orderReturnItem.updateMany({
          where: { returnRequestId: refund.orderReturnRequestId },
          data: { status: ReturnItemStatus.REFUNDED },
        });
      }

      // Recalculate total completed refunds including this one
      const completedAggregate = await tx.refundRecord.aggregate({
        where: {
          orderId: order.id,
          status: RefundStatus.COMPLETED,
        },
        _sum: { amountCents: true },
      });
      const totalCompletedCents = completedAggregate._sum.amountCents ?? 0;

      const newPaymentStatus =
        totalCompletedCents >= order.totalCents
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;

      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: newPaymentStatus },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId,
          adminId: actor.id,
          adminName: actor.name || 'Staff Administrator',
          action: 'REFUND_COMPLETED',
          fieldChanged: 'paymentStatus',
          previousValue: order.paymentStatus,
          newValue: newPaymentStatus,
          reason: `Refund of Rs. ${(refund.amountCents / 100).toFixed(2)} completed by ${actor.name || actor.id}. Requester: ${refund.requestedById}. Approver: ${refund.approvedById || 'N/A'}. External ref: ${dto.externalReference.trim()}`,
        },
      });

      if (this.notificationsService) {
        this.notificationsService.sendRefundNotification({
          orderNumber: order.orderNumber,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          amountCents: refund.amountCents,
          method: refund.method,
          reference: dto.externalReference.trim(),
        }).catch((err) => this.logger.error('Failed to dispatch refund notification:', err));
      }

      if (this.ordersGateway) {
        this.ordersGateway.broadcastOrderEvent('order.refund.updated', {
          orderId,
          orderNumber: order.orderNumber,
          event: 'order.refund.updated',
          timestamp: new Date().toISOString(),
          data: updatedRefund,
          actor,
        });
        this.ordersGateway.broadcastOrderEvent('order.payment.updated', {
          orderId,
          orderNumber: order.orderNumber,
          event: 'order.payment.updated',
          timestamp: new Date().toISOString(),
          data: { paymentStatus: newPaymentStatus },
          actor,
        });
      }

      return updatedRefund;
    });
  }

  /**
   * Rejects a requested or approved refund.
   */
  async rejectRefund(
    orderId: string,
    refundId: string,
    dto: AdminRejectRefundDto,
    actor?: { id?: string; name?: string }
  ) {
    if (!actor?.id || !actor.id.trim()) {
      throw new BadRequestException('Authenticated admin identity is required to reject a refund.');
    }

    if (!dto.rejectionReason || !dto.rejectionReason.trim()) {
      throw new BadRequestException('Rejection reason is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{ id: string; orderNumber: string }>>`
        SELECT id, "orderNumber" FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;
      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundException(`Order "${orderId}" not found`);
      }

      const refund = await tx.refundRecord.findUnique({
        where: { id: refundId },
      });
      if (!refund || refund.orderId !== orderId) {
        throw new NotFoundException(`Refund "${refundId}" not found for order "${orderId}"`);
      }

      if (
        refund.status !== RefundStatus.REQUESTED &&
        refund.status !== RefundStatus.APPROVED
      ) {
        throw new BadRequestException(
          `Invalid state transition: Cannot reject refund with current status "${refund.status}". Only REQUESTED or APPROVED refunds can be rejected.`
        );
      }

      const updated = await tx.refundRecord.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.REJECTED,
          failureReason: dto.rejectionReason.trim(),
        },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId,
          adminId: actor.id,
          adminName: actor.name || 'Staff Administrator',
          action: 'REFUND_REJECTED',
          fieldChanged: 'refundStatus',
          previousValue: refund.status,
          newValue: RefundStatus.REJECTED,
          reason: `Refund rejected by ${actor.name || actor.id}. Reason: ${dto.rejectionReason.trim()}`,
        },
      });

      if (this.ordersGateway) {
        this.ordersGateway.broadcastOrderEvent('order.refund.updated', {
          orderId,
          orderNumber: lockedOrders[0].orderNumber,
          event: 'order.refund.updated',
          timestamp: new Date().toISOString(),
          data: updated,
          actor,
        });
      }

      return updated;
    });
  }

  /**
   * Marks an in-flight processing refund as failed.
   */
  async failRefund(
    orderId: string,
    refundId: string,
    dto: AdminFailRefundDto,
    actor?: { id?: string; name?: string }
  ) {
    if (!actor?.id || !actor.id.trim()) {
      throw new BadRequestException('Authenticated admin identity is required to fail a refund.');
    }

    if (!dto.failureReason || !dto.failureReason.trim()) {
      throw new BadRequestException('Failure reason is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{ id: string; orderNumber: string }>>`
        SELECT id, "orderNumber" FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;
      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundException(`Order "${orderId}" not found`);
      }

      const refund = await tx.refundRecord.findUnique({
        where: { id: refundId },
      });
      if (!refund || refund.orderId !== orderId) {
        throw new NotFoundException(`Refund "${refundId}" not found for order "${orderId}"`);
      }

      if (refund.status !== RefundStatus.PROCESSING) {
        throw new BadRequestException(
          `Invalid state transition: Cannot mark refund failed with current status "${refund.status}". Only PROCESSING refunds can be marked FAILED.`
        );
      }

      const updated = await tx.refundRecord.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.FAILED,
          failureReason: dto.failureReason.trim(),
        },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId,
          adminId: actor.id,
          adminName: actor.name || 'Staff Administrator',
          action: 'REFUND_FAILED',
          fieldChanged: 'refundStatus',
          previousValue: RefundStatus.PROCESSING,
          newValue: RefundStatus.FAILED,
          reason: `Refund marked failed by ${actor.name || actor.id}. Reason: ${dto.failureReason.trim()}`,
        },
      });

      if (this.ordersGateway) {
        this.ordersGateway.broadcastOrderEvent('order.refund.updated', {
          orderId,
          orderNumber: lockedOrders[0].orderNumber,
          event: 'order.refund.updated',
          timestamp: new Date().toISOString(),
          data: updated,
          actor,
        });
      }

      return updated;
    });
  }

  /**
   * Retrieves audit logs for an order.
   */
  async getAuditHistory(orderId: string) {
    return this.prisma.orderAuditLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Adds an internal staff note.
   */
  async addAdminNote(
    orderId: string,
    dto: AdminAddNoteDto,
    actor?: { id?: string; name?: string }
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.orderNote.create({
        data: {
          orderId: order.id,
          authorId: actor?.id || null,
          authorName: actor?.name || 'Staff Administrator',
          note: dto.note,
          isInternal: dto.isInternal,
        },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'NOTE_ADDED',
          fieldChanged: 'orderNotes',
          newValue: dto.note.slice(0, 50),
          reason: 'Staff added administrative note',
        },
      });

      return created;
    });

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.updated',
        timestamp: new Date().toISOString(),
        data: { noteAdded: true },
        actor,
      });
    }

    return note;
  }

  /**
   * Generates high-level financial reconciliation summary metrics.
   */
  async getFinancialReconciliationSummary(query: AdminReconciliationQueryDto) {
    const where: Prisma.OrderWhereInput = {};

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod as PaymentMethod;
    }
    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus as PaymentStatus;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerEmail: { contains: query.search, mode: 'insensitive' } },
        {
          paymentAttempts: {
            some: {
              gatewayReference: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
        {
          refundRecords: {
            some: {
              OR: [
                { reference: { contains: query.search, mode: 'insensitive' } },
                { externalReference: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        paymentAttempts: {
          where: { status: PaymentAttemptStatus.SUCCEEDED },
        },
        refundRecords: true,
        returnRequests: {
          include: { items: true },
        },
      },
    });

    let totalOrders = orders.length;
    let totalOrderAmountCents = 0;
    let totalVerifiedCollectedCents = 0;
    let totalCompletedRefundsCents = 0;
    let totalReservedRefundsCents = 0;
    let totalAvailableRefundBalanceCents = 0;
    let discrepancyCount = 0;

    for (const order of orders) {
      totalOrderAmountCents += order.totalCents;

      // Calculate verified collections
      let verifiedCollected = 0;
      if (
        order.paymentMethod === PaymentMethod.CARD_PAYHERE ||
        order.paymentMethod === PaymentMethod.BANK_TRANSFER
      ) {
        const seenRefs = new Set<string>();
        for (const pa of order.paymentAttempts) {
          if (pa.gatewayReference && !seenRefs.has(pa.gatewayReference)) {
            seenRefs.add(pa.gatewayReference);
            verifiedCollected += pa.amountCents;
          }
        }
      }
      totalVerifiedCollectedCents += verifiedCollected;

      let completedRefunds = 0;
      let reservedRefunds = 0;
      const seenRefundRefs = new Set<string>();
      let hasDupRefundRef = false;
      let hasCompletedWithoutEvidence = false;

      for (const ref of order.refundRecords) {
        if (ref.status === RefundStatus.COMPLETED) {
          completedRefunds += ref.amountCents;
          if (ref.externalReference) {
            if (seenRefundRefs.has(ref.externalReference)) {
              hasDupRefundRef = true;
            }
            seenRefundRefs.add(ref.externalReference);
          } else {
            hasCompletedWithoutEvidence = true;
          }
        } else if (
          ref.status === RefundStatus.REQUESTED ||
          ref.status === RefundStatus.APPROVED ||
          ref.status === RefundStatus.PROCESSING
        ) {
          reservedRefunds += ref.amountCents;
        }
      }

      totalCompletedRefundsCents += completedRefunds;
      totalReservedRefundsCents += reservedRefunds;

      const refundCeiling = Math.min(order.totalCents, verifiedCollected);
      const availableBalance = Math.max(0, refundCeiling - completedRefunds - reservedRefunds);
      totalAvailableRefundBalanceCents += availableBalance;

      // Check discrepancies
      const hasExceedsCollection = completedRefunds + reservedRefunds > verifiedCollected;
      const hasPaidWithoutCollection = order.paymentStatus === PaymentStatus.PAID && verifiedCollected === 0;
      const hasReturnMismatch = order.returnRequests.some((rr) =>
        rr.items.some((it) => it.status === ReturnItemStatus.REFUNDED) &&
        !order.refundRecords.some((rf) => rf.orderReturnRequestId === rr.id && rf.status === RefundStatus.COMPLETED)
      );

      if (
        hasExceedsCollection ||
        hasPaidWithoutCollection ||
        hasDupRefundRef ||
        hasCompletedWithoutEvidence ||
        hasReturnMismatch
      ) {
        discrepancyCount++;
      }
    }

    return {
      totalOrders,
      totalOrderAmountCents,
      totalVerifiedCollectedCents,
      totalCompletedRefundsCents,
      totalReservedRefundsCents,
      totalAvailableRefundBalanceCents,
      discrepancyCount,
    };
  }

  /**
   * Retrieves paginated financial reconciliation records with verified audit details and discrepancy flags.
   */
  async getFinancialReconciliation(query: AdminReconciliationQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Prisma.OrderWhereInput = {};

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod as PaymentMethod;
    }
    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus as PaymentStatus;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerEmail: { contains: query.search, mode: 'insensitive' } },
        {
          paymentAttempts: {
            some: {
              gatewayReference: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
        {
          refundRecords: {
            some: {
              OR: [
                { reference: { contains: query.search, mode: 'insensitive' } },
                { externalReference: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }
    if (query.refundStatus) {
      where.refundRecords = {
        some: { status: query.refundStatus as RefundStatus },
      };
    }

    // Fetch all matching orders to calculate financial reconciliation state accurately
    const orders = await this.prisma.order.findMany({
      where,
      include: {
        paymentAttempts: {
          where: { status: PaymentAttemptStatus.SUCCEEDED },
          orderBy: { createdAt: 'desc' },
        },
        refundRecords: {
          include: {
            orderReturnRequest: {
              select: { id: true, returnNumber: true, status: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        returnRequests: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map each order to its detailed reconciliation entry
    const reconciliationItems = orders.map((order) => {
      // 1. Calculate verified collections
      let verifiedCollectedCents = 0;
      const paymentReferences: string[] = [];
      const paymentRefCounts = new Map<string, number>();

      for (const pa of order.paymentAttempts) {
        if (pa.gatewayReference) {
          paymentRefCounts.set(pa.gatewayReference, (paymentRefCounts.get(pa.gatewayReference) || 0) + 1);
        }
      }

      if (
        order.paymentMethod === PaymentMethod.CARD_PAYHERE ||
        order.paymentMethod === PaymentMethod.BANK_TRANSFER
      ) {
        const seenRefs = new Set<string>();
        for (const pa of order.paymentAttempts) {
          if (pa.gatewayReference) {
            paymentReferences.push(pa.gatewayReference);
            if (!seenRefs.has(pa.gatewayReference)) {
              seenRefs.add(pa.gatewayReference);
              verifiedCollectedCents += pa.amountCents;
            }
          }
        }
      }

      // 2. Calculate refunds
      let completedRefundsCents = 0;
      let reservedRefundsCents = 0;
      const refundReferences: string[] = [];
      const refundRefCounts = new Map<string, number>();
      let hasCompletedWithoutEvidence = false;

      for (const ref of order.refundRecords) {
        if (ref.status === RefundStatus.COMPLETED) {
          completedRefundsCents += ref.amountCents;
          if (ref.externalReference) {
            refundReferences.push(ref.externalReference);
            refundRefCounts.set(ref.externalReference, (refundRefCounts.get(ref.externalReference) || 0) + 1);
          } else {
            hasCompletedWithoutEvidence = true;
          }
        } else if (
          ref.status === RefundStatus.REQUESTED ||
          ref.status === RefundStatus.APPROVED ||
          ref.status === RefundStatus.PROCESSING
        ) {
          reservedRefundsCents += ref.amountCents;
        }
      }

      const refundCeilingCents = Math.min(order.totalCents, verifiedCollectedCents);
      const availableRefundBalanceCents = Math.max(
        0,
        refundCeilingCents - completedRefundsCents - reservedRefundsCents
      );

      // 3. Detect discrepancies
      const discrepancies: string[] = [];
      if (completedRefundsCents + reservedRefundsCents > verifiedCollectedCents) {
        discrepancies.push('REFUNDS_EXCEED_COLLECTIONS: Total refunds exceed verified collected funds');
      }
      if (order.paymentStatus === PaymentStatus.PAID && verifiedCollectedCents === 0) {
        discrepancies.push('PAID_WITHOUT_COLLECTION: Order marked PAID without verified collection evidence');
      }
      for (const [ref, count] of paymentRefCounts.entries()) {
        if (count > 1) {
          discrepancies.push(`DUPLICATE_PAYMENT_REF: Payment reference "${ref}" appears ${count} times`);
        }
      }
      for (const [ref, count] of refundRefCounts.entries()) {
        if (count > 1) {
          discrepancies.push(`DUPLICATE_REFUND_REF: Refund reference "${ref}" appears ${count} times`);
        }
      }
      if (hasCompletedWithoutEvidence) {
        discrepancies.push('COMPLETED_WITHOUT_EVIDENCE: Refund marked COMPLETED without external transaction reference');
      }
      const hasReturnMismatch = order.returnRequests.some((rr) =>
        rr.items.some((it) => it.status === ReturnItemStatus.REFUNDED) &&
        !order.refundRecords.some((rf) => rf.orderReturnRequestId === rr.id && rf.status === RefundStatus.COMPLETED)
      );
      if (hasReturnMismatch) {
        discrepancies.push('RETURN_REFUND_MISMATCH: Return item marked REFUNDED without completed linked refund');
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        createdAt: order.createdAt,
        totalCents: order.totalCents,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        verifiedCollectedCents,
        completedRefundsCents,
        reservedRefundsCents,
        availableRefundBalanceCents,
        paymentReferences: Array.from(new Set(paymentReferences)),
        refundReferences: Array.from(new Set(refundReferences)),
        refundRecords: order.refundRecords.map((r) => ({
          id: r.id,
          amountCents: r.amountCents,
          method: r.method,
          status: r.status,
          reference: r.reference,
          externalReference: r.externalReference,
          requestedById: r.requestedById,
          approvedById: r.approvedById,
          completedById: r.completedById,
          processedBy: r.processedBy,
          reason: r.reason,
          failureReason: r.failureReason,
          createdAt: r.createdAt,
          orderReturnRequestId: r.orderReturnRequestId,
          returnNumber: r.orderReturnRequest?.returnNumber || null,
        })),
        returnRequestsCount: order.returnRequests.length,
        hasDiscrepancy: discrepancies.length > 0,
        discrepancies,
      };
    });

    // Apply hasDiscrepancy filter if provided
    let filteredItems = reconciliationItems;
    if (query.hasDiscrepancy !== undefined) {
      filteredItems = reconciliationItems.filter((it) => it.hasDiscrepancy === query.hasDiscrepancy);
    }

    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(offset, offset + limit);

    // Compute summary over the filtered items
    const summary = {
      totalOrders: total,
      totalOrderAmountCents: filteredItems.reduce((acc, it) => acc + it.totalCents, 0),
      totalVerifiedCollectedCents: filteredItems.reduce((acc, it) => acc + it.verifiedCollectedCents, 0),
      totalCompletedRefundsCents: filteredItems.reduce((acc, it) => acc + it.completedRefundsCents, 0),
      totalReservedRefundsCents: filteredItems.reduce((acc, it) => acc + it.reservedRefundsCents, 0),
      totalOutstandingRefundableCents: filteredItems.reduce((acc, it) => acc + it.availableRefundBalanceCents, 0),
      discrepancyCount: filteredItems.filter((it) => it.hasDiscrepancy).length,
    };

    return {
      items: paginatedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      summary,
    };
  }
}

