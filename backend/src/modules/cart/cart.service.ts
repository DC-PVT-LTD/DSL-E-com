import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  MergeCartDto,
  AddSchoolPackToCartDto,
  CartResponse,
  CartItemResponse,
} from './dto/cart.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Helper to resolve or create a Cart record for an authenticated user or guest.
   */
  async getOrCreateCartRecord(
    userId?: string | null,
    sessionId?: string | null
  ): Promise<{ cart: any; sessionId?: string | null }> {
    if (userId) {
      let userCart = await this.prisma.cart.findUnique({
        where: { userId },
      });

      if (!userCart) {
        userCart = await this.prisma.cart.create({
          data: { userId },
        });
      }

      return { cart: userCart };
    }

    // Guest cart resolution
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = crypto.randomUUID();
    }

    let guestCart = await this.prisma.cart.findUnique({
      where: { sessionId: activeSessionId },
    });

    if (!guestCart) {
      guestCart = await this.prisma.cart.create({
        data: { sessionId: activeSessionId },
      });
    }

    return { cart: guestCart, sessionId: activeSessionId };
  }

  /**
   * Retrieve calculated cart with authoritative server pricing and live stock indicators.
   */
  async getCart(
    userId?: string | null,
    sessionId?: string | null
  ): Promise<CartResponse> {
    const { cart, sessionId: generatedSessionId } = await this.getOrCreateCartRecord(
      userId,
      sessionId
    );

    return this.buildCartResponse(cart.id, userId, generatedSessionId || sessionId);
  }

  /**
   * Add a product or variant to the cart with server stock & eligibility checks.
   */
  async addItem(
    dto: AddToCartDto,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<CartResponse> {
    const { cart, sessionId: resolvedSessionId } = await this.getOrCreateCartRecord(
      userId,
      sessionId
    );

    // 1. Verify product existence & sale eligibility
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { variants: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID '${dto.productId}' not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException(`Product '${product.name}' is currently unavailable for sale`);
    }

    // 2. Verify variant if supplied
    let variant: any = null;
    if (dto.variantId) {
      variant = product.variants.find((v) => v.id === dto.variantId);
      if (!variant) {
        throw new BadRequestException(
          `Variant '${dto.variantId}' does not belong to product '${product.name}'`
        );
      }
      if (!variant.isActive) {
        throw new BadRequestException(
          `Variant '${variant.name}' is currently inactive`
        );
      }
    }

    const availableStock = variant ? variant.stockQuantity : product.stockQuantity;
    if (availableStock <= 0) {
      throw new BadRequestException(
        `'${variant ? variant.name : product.name}' is currently out of stock`
      );
    }

    // 3. Check for existing cart item to prevent duplicates
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: dto.productId,
        variantId: dto.variantId || null,
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + dto.quantity;
      if (newQuantity > availableStock) {
        throw new BadRequestException(
          `Cannot add ${dto.quantity} items. Available stock: ${availableStock}, current in cart: ${existingItem.quantity}`
        );
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      if (dto.quantity > availableStock) {
        throw new BadRequestException(
          `Requested quantity (${dto.quantity}) exceeds available stock (${availableStock})`
        );
      }

      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          variantId: dto.variantId || null,
          quantity: dto.quantity,
        },
      });
    }

    return this.buildCartResponse(cart.id, userId, resolvedSessionId || sessionId);
  }

  /**
   * Add a customized school pack bundle to cart with full server stock and substitute validation.
   */
  async addSchoolPack(
    dto: AddSchoolPackToCartDto,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<CartResponse> {
    const { cart, sessionId: resolvedSessionId } = await this.getOrCreateCartRecord(
      userId,
      sessionId
    );

    // 1. Validate pack
    const pack = await this.prisma.schoolPack.findUnique({
      where: { id: dto.packId },
      include: { items: true },
    });

    if (!pack) {
      throw new NotFoundException(`School pack with ID '${dto.packId}' not found`);
    }

    if (!pack.isActive) {
      throw new BadRequestException(`School pack '${pack.name}' is currently unavailable`);
    }

    // 2. Validate products belong to pack or its allowed substitutes
    const allowedProductIds = new Set<string>();
    for (const item of pack.items) {
      allowedProductIds.add(item.productId);
      for (const subId of item.substituteProductIds) {
        allowedProductIds.add(subId);
      }
    }

    for (const item of dto.items) {
      if (!allowedProductIds.has(item.productId)) {
        throw new BadRequestException(
          `Product '${item.productId}' is not a valid component or substitute of pack '${pack.name}'`
        );
      }
    }

    // 3. Batch fetch products to validate active status and stock
    const requestedProductIds = dto.items.map((i) => i.productId);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: requestedProductIds } },
      include: { variants: true },
    });
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const prod = productMap.get(item.productId);
      if (!prod || !prod.isActive) {
        throw new BadRequestException(`Product '${item.productId}' is unavailable`);
      }

      let variant = null;
      if (item.variantId) {
        variant = prod.variants.find((v) => v.id === item.variantId);
        if (!variant || !variant.isActive) {
          throw new BadRequestException(`Variant '${item.variantId}' is unavailable`);
        }
      }

      const availableStock = variant ? variant.stockQuantity : prod.stockQuantity;
      if (availableStock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for '${variant ? variant.name : prod.name}'. Available: ${availableStock}, requested: ${item.quantity}`
        );
      }
    }

    // 4. Add or update items in cart
    for (const item of dto.items) {
      const existingItem = await this.prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: item.productId,
          variantId: item.variantId || null,
        },
      });

      const prod = productMap.get(item.productId)!;
      const variant = item.variantId ? prod.variants.find((v) => v.id === item.variantId) : null;
      const availableStock = variant ? variant.stockQuantity : prod.stockQuantity;

      if (existingItem) {
        const newQuantity = Math.min(existingItem.quantity + item.quantity, availableStock);
        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
          },
        });
      }
    }

    this.logger.log(
      `Added school pack '${pack.name}' (${dto.items.length} lines) to cart '${cart.id}'`
    );

    return this.buildCartResponse(cart.id, userId, resolvedSessionId || sessionId);
  }

  /**
   * Update item quantity with live stock validation.
   */
  async updateItemQuantity(
    itemId: string,
    dto: UpdateCartItemDto,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<CartResponse> {
    const { cart, sessionId: resolvedSessionId } = await this.getOrCreateCartRecord(
      userId,
      sessionId
    );

    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        product: true,
        variant: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Cart item with ID '${itemId}' not found`);
    }

    // Prevent cross-user / cross-cart tampering
    if (item.cartId !== cart.id) {
      throw new ForbiddenException('Access to this cart item is not authorized');
    }

    const availableStock = item.variant
      ? item.variant.stockQuantity
      : item.product.stockQuantity;

    if (dto.quantity > availableStock) {
      throw new BadRequestException(
        `Requested quantity (${dto.quantity}) exceeds available stock (${availableStock})`
      );
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    return this.buildCartResponse(cart.id, userId, resolvedSessionId || sessionId);
  }

  /**
   * Remove a specific item from the cart.
   */
  async removeItem(
    itemId: string,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<CartResponse> {
    const { cart, sessionId: resolvedSessionId } = await this.getOrCreateCartRecord(
      userId,
      sessionId
    );

    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`Cart item with ID '${itemId}' not found`);
    }

    if (item.cartId !== cart.id) {
      throw new ForbiddenException('Access to this cart item is not authorized');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.buildCartResponse(cart.id, userId, resolvedSessionId || sessionId);
  }

  /**
   * Phase A: Remove only specific purchased items from the cart.
   * Preserves unselected or unpurchased items in the database cart.
   */
  async removePurchasedItems(
    purchasedItems: Array<{ productId: string; variantId?: string | null }>,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<CartResponse> {
    const { cart, sessionId: resolvedSessionId } = await this.getOrCreateCartRecord(
      userId,
      sessionId
    );

    if (purchasedItems && purchasedItems.length > 0) {
      for (const item of purchasedItems) {
        await this.prisma.cartItem.deleteMany({
          where: {
            cartId: cart.id,
            productId: item.productId,
            variantId: item.variantId || null,
          },
        });
      }
    }

    return this.buildCartResponse(cart.id, userId, resolvedSessionId || sessionId);
  }

  /**
   * Clear all items from the cart.
   */
  async clearCart(
    userId?: string | null,
    sessionId?: string | null
  ): Promise<CartResponse> {
    const { cart, sessionId: resolvedSessionId } = await this.getOrCreateCartRecord(
      userId,
      sessionId
    );

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.buildCartResponse(cart.id, userId, resolvedSessionId || sessionId);
  }

  /**
   * Merge guest cart into authenticated customer cart upon login or registration.
   */
  async mergeGuestCart(
    dto: MergeCartDto,
    userId: string
  ): Promise<CartResponse> {
    const userCart = (await this.getOrCreateCartRecord(userId)).cart;

    // Look for guest cart by session ID (ensuring it's an unauthenticated cart)
    const guestCart = await this.prisma.cart.findFirst({
      where: {
        sessionId: dto.guestSessionId,
        userId: null,
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

    if (!guestCart || guestCart.items.length === 0) {
      // Nothing to merge
      return this.buildCartResponse(userCart.id, userId, null);
    }

    // Merge each guest item safely
    for (const guestItem of guestCart.items) {
      // Revalidate product status
      if (!guestItem.product || !guestItem.product.isActive) {
        continue; // Skip deactivated products
      }

      if (guestItem.variantId && (!guestItem.variant || !guestItem.variant.isActive)) {
        continue;
      }

      const availableStock = guestItem.variant
        ? guestItem.variant.stockQuantity
        : guestItem.product.stockQuantity;

      if (availableStock <= 0) {
        continue; // Skip out-of-stock items
      }

      // Check if user's cart already has this product + variant
      const existingUserItem = await this.prisma.cartItem.findFirst({
        where: {
          cartId: userCart.id,
          productId: guestItem.productId,
          variantId: guestItem.variantId || null,
        },
      });

      if (existingUserItem) {
        const mergedQty = Math.min(
          existingUserItem.quantity + guestItem.quantity,
          availableStock
        );
        await this.prisma.cartItem.update({
          where: { id: existingUserItem.id },
          data: { quantity: mergedQty },
        });
      } else {
        const initialQty = Math.min(guestItem.quantity, availableStock);
        if (initialQty > 0) {
          await this.prisma.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: guestItem.productId,
              variantId: guestItem.variantId || null,
              quantity: initialQty,
            },
          });
        }
      }
    }

    // Delete the guest cart after successful merge to avoid duplicate usage
    try {
      await this.prisma.cart.delete({
        where: { id: guestCart.id },
      });
    } catch (err) {
      this.logger.warn(`Failed to cleanup guest cart '${guestCart.id}' after merge:`, err);
    }

    return this.buildCartResponse(userCart.id, userId, null);
  }

  /**
   * Internal builder for authoritative cart response with full pricing & stock indicators.
   */
  private async buildCartResponse(
    cartId: string,
    userId?: string | null,
    sessionId?: string | null
  ): Promise<CartResponse> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            variant: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException(`Cart with ID '${cartId}' not found`);
    }

    // Retrieve store settings for shipping rules
    let flatDeliveryFeeCents = 35000;
    let freeDeliveryThresholdCents = 500000;

    try {
      const settings = await this.prisma.storeSettings.findFirst();
      if (settings) {
        flatDeliveryFeeCents = settings.flatDeliveryFeeCents;
        freeDeliveryThresholdCents = settings.freeDeliveryThresholdCents;
      }
    } catch {
      // Use defaults if settings table is unavailable
    }

    const warnings: string[] = [];
    let subtotalCents = 0;
    let totalItems = 0;

    const formattedItems: CartItemResponse[] = cart.items.map((item) => {
      const p = item.product;
      const v = item.variant;

      // Authoritative database price (ignoring any client inputs)
      const unitPriceCents = v ? v.priceCents : p.priceCents;
      const lineTotalCents = unitPriceCents * item.quantity;
      const availableStock = v ? v.stockQuantity : p.stockQuantity;

      const isOutOfStock = availableStock <= 0;
      const exceedsStock = item.quantity > availableStock;
      const isAvailable = p.isActive && (v ? v.isActive : true) && !isOutOfStock;

      if (!p.isActive) {
        warnings.push(`'${p.name}' is no longer available.`);
      } else if (isOutOfStock) {
        warnings.push(`'${v ? v.name : p.name}' is currently out of stock.`);
      } else if (exceedsStock) {
        warnings.push(
          `Requested quantity for '${v ? v.name : p.name}' exceeds available stock (${availableStock}).`
        );
      }

      subtotalCents += lineTotalCents;
      totalItems += item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        product: {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          images: p.images,
          priceCents: p.priceCents,
          stockQuantity: p.stockQuantity,
          isActive: p.isActive,
          categoryName: p.category?.name,
        },
        variant: v
          ? {
              id: v.id,
              name: v.name,
              sku: v.sku,
              priceCents: v.priceCents,
              stockQuantity: v.stockQuantity,
              isActive: v.isActive,
            }
          : null,
        quantity: item.quantity,
        unitPriceCents,
        totalPriceCents: lineTotalCents,
        isAvailable,
        isOutOfStock,
        exceedsStock,
      };
    });

    const isFreeDeliveryEligible = subtotalCents >= freeDeliveryThresholdCents;
    const deliveryCents =
      subtotalCents > 0 ? (isFreeDeliveryEligible ? 0 : flatDeliveryFeeCents) : 0;
    const discountCents = 0; // Promotion validation can be linked to Promotion table if needed
    const totalCents = Math.max(0, subtotalCents - discountCents + deliveryCents);

    return {
      id: cart.id,
      userId: cart.userId,
      sessionId: cart.sessionId || sessionId,
      items: formattedItems,
      itemCount: totalItems,
      subtotalCents,
      discountCents,
      deliveryCents,
      totalCents,
      isFreeDeliveryEligible,
      freeDeliveryThresholdCents,
      warnings: warnings.length > 0 ? warnings : undefined,
      updatedAt: cart.updatedAt,
    };
  }
}

