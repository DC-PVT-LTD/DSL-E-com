import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
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
  AdminAddNoteDto,
} from './dto/admin-orders.dto';
import {
  OrderStatus,
  PaymentStatus,
  ReturnStatus,
  ReturnItemStatus,
  InventoryChangeReason,
  UserRole,
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
  ) {}

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
          },
          orderBy: { createdAt: 'desc' },
        },
        refundRecords: {
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

    return {
      ...order,
      customerNotes,
      schoolPacksSnapshot,
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
          for (const item of order.items) {
            if (item.variantId) {
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
      // Restore inventory if requested and not previously restored
      if (dto.restoreInventory && order.items && order.items.length > 0) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId || null,
              previousQuantity: 0,
              newQuantity: item.quantity,
              changeAmount: item.quantity,
              reason: InventoryChangeReason.RESTOCK,
              note: `Restored stock from cancelled order ${order.orderNumber}`,
              performedById: actor?.id || 'STAFF',
            },
          });
        }
      }

      // Record refund if requested and order was paid
      let newPaymentStatus = order.paymentStatus;
      if (dto.processRefund && (order.paymentStatus === PaymentStatus.PAID)) {
        await tx.refundRecord.create({
          data: {
            orderId: order.id,
            amountCents: order.totalCents,
            method: 'CANCELLATION_REFUND',
            reference: `REF-CANC-${order.orderNumber}`,
            reason: dto.reason,
            processedBy: actor?.name || 'Staff',
          },
        });
        newPaymentStatus = PaymentStatus.REFUNDED;
      }

      // Record Audit Log
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'ORDER_CANCELLED',
          fieldChanged: 'orderStatus',
          previousValue: order.orderStatus,
          newValue: OrderStatus.CANCELLED,
          reason: dto.reason,
        },
      });

      return tx.order.update({
        where: { id },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: newPaymentStatus,
          notes: order.notes ? `${order.notes} | [Cancelled: ${dto.reason}]` : `[Cancelled: ${dto.reason}]`,
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

    const returnNumber = `RET-${order.orderNumber}-${Date.now().toString().slice(-4)}`;

    const returnReq = await this.prisma.$transaction(async (tx) => {
      const created = await tx.orderReturnRequest.create({
        data: {
          orderId: order.id,
          returnNumber,
          status: ReturnStatus.PENDING,
          reason: dto.reason,
          items: {
            create: dto.items.map((it) => {
              const matched = order.items.find((oi) => oi.id === it.orderItemId);
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
      let targetStatus = returnReq.status;
      let itemStatus: ReturnItemStatus = ReturnItemStatus.PENDING;

      if (dto.action === 'APPROVE') {
        targetStatus = ReturnStatus.APPROVED;
        itemStatus = ReturnItemStatus.APPROVED;
      } else if (dto.action === 'REJECT') {
        targetStatus = ReturnStatus.REJECTED;
        itemStatus = ReturnItemStatus.REJECTED;
      } else if (dto.action === 'CONFIRM_RECEIVED') {
        targetStatus = ReturnStatus.COMPLETED;
        itemStatus = ReturnItemStatus.RECEIVED;

        // If restocking returned products
        if (dto.restockItems) {
          for (const item of returnReq.items) {
            const orderItem = await tx.orderItem.findUnique({ where: { id: item.orderItemId } });
            if (orderItem) {
              await tx.product.update({
                where: { id: orderItem.productId },
                data: { stockQuantity: { increment: item.quantity } },
              });
              if (orderItem.variantId) {
                await tx.productVariant.update({
                  where: { id: orderItem.variantId },
                  data: { stockQuantity: { increment: item.quantity } },
                });
              }

              await tx.inventoryMovement.create({
                data: {
                  productId: orderItem.productId,
                  variantId: orderItem.variantId || null,
                  previousQuantity: 0,
                  newQuantity: item.quantity,
                  changeAmount: item.quantity,
                  reason: InventoryChangeReason.RESTOCK,
                  note: `Restocked from Return ${returnReq.returnNumber}`,
                  performedById: actor?.id || 'STAFF',
                },
              });
            }
          }
        }
      }

      await tx.orderReturnItem.updateMany({
        where: { returnRequestId: returnReq.id },
        data: {
          status: itemStatus,
          rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : null,
          receivedAt: dto.action === 'CONFIRM_RECEIVED' ? new Date() : null,
        },
      });

      const res = await tx.orderReturnRequest.update({
        where: { id: returnReq.id },
        data: {
          status: targetStatus,
          rejectionReason: dto.action === 'REJECT' ? dto.rejectionReason : returnReq.rejectionReason,
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
          previousValue: returnReq.status,
          newValue: targetStatus,
          reason: dto.rejectionReason || `Staff executed return action ${dto.action}`,
        },
      });

      return res;
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
   * Processes manual or verified refund recording.
   */
  async processRefund(
    orderId: string,
    dto: AdminProcessRefundDto,
    actor?: { id?: string; name?: string }
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }

    if (dto.amountCents > order.totalCents) {
      throw new BadRequestException(
        `Refund amount (Rs. ${(dto.amountCents / 100).toFixed(2)}) cannot exceed order grand total (Rs. ${(order.totalCents / 100).toFixed(2)})`
      );
    }

    const refund = await this.prisma.$transaction(async (tx) => {
      const created = await tx.refundRecord.create({
        data: {
          orderId: order.id,
          amountCents: dto.amountCents,
          method: dto.method,
          reference: dto.reference || `REF-${Date.now()}`,
          reason: dto.reason,
          processedBy: actor?.name || 'Staff',
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          adminId: actor?.id || null,
          adminName: actor?.name || 'Staff Administrator',
          action: 'REFUND_RECORDED',
          fieldChanged: 'paymentStatus',
          previousValue: order.paymentStatus,
          newValue: PaymentStatus.REFUNDED,
          reason: `Refund: Rs. ${(dto.amountCents / 100).toFixed(2)} via ${dto.method}. Reason: ${dto.reason}`,
        },
      });

      return created;
    });

    if (this.notificationsService) {
      this.notificationsService.sendRefundNotification({
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        amountCents: dto.amountCents,
        method: dto.method,
        reference: dto.reference,
      }).catch((err) => this.logger.error('Failed to dispatch refund notification:', err));
    }

    if (this.ordersGateway) {
      this.ordersGateway.broadcastOrderEvent('order.refund.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.refund.updated',
        timestamp: new Date().toISOString(),
        data: refund,
        actor,
      });
      this.ordersGateway.broadcastOrderEvent('order.payment.updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        event: 'order.payment.updated',
        timestamp: new Date().toISOString(),
        data: { paymentStatus: PaymentStatus.REFUNDED },
        actor,
      });
    }

    return refund;
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
}

