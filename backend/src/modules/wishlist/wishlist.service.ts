import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WishlistResponseDto, WishlistItemResponseDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve the customer's full wishlist with current product catalogue details.
   */
  async getWishlist(userId: string): Promise<WishlistResponseDto> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedItems: WishlistItemResponseDto[] = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      createdAt: item.createdAt,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        priceCents: item.product.priceCents,
        compareAtPriceCents: item.product.compareAtPriceCents,
        stockQuantity: item.product.stockQuantity,
        isActive: item.product.isActive,
        images: item.product.images || [],
        categoryName: item.product.category?.name,
        brandName: item.product.brand?.name,
      },
    }));

    return {
      items: mappedItems,
      itemCount: mappedItems.length,
    };
  }

  /**
   * Add a product to customer's wishlist.
   * Handles duplicate additions safely and idempotently.
   */
  async addItem(userId: string, productId: string): Promise<WishlistItemResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        brand: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException(`Product with ID "${productId}" not found or unavailable`);
    }

    // Check if already in wishlist (idempotency guard)
    let item = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
      },
    });

    if (!item) {
      item = await this.prisma.wishlistItem.create({
        data: {
          userId,
          productId,
        },
        include: {
          product: {
            include: {
              category: true,
              brand: true,
            },
          },
        },
      });
      this.logger.log(`Customer ${userId} saved product ${productId} to wishlist`);
    }

    return {
      id: item.id,
      productId: item.productId,
      createdAt: item.createdAt,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        priceCents: item.product.priceCents,
        compareAtPriceCents: item.product.compareAtPriceCents,
        stockQuantity: item.product.stockQuantity,
        isActive: item.product.isActive,
        images: item.product.images || [],
        categoryName: item.product.category?.name,
        brandName: item.product.brand?.name,
      },
    };
  }

  /**
   * Remove a product from customer's wishlist.
   */
  async removeItem(userId: string, productId: string): Promise<{ success: boolean; productId: string }> {
    await this.prisma.wishlistItem.deleteMany({
      where: {
        userId,
        productId,
      },
    });
    this.logger.log(`Customer ${userId} removed product ${productId} from wishlist`);
    return { success: true, productId };
  }

  /**
   * Retrieve count of wishlist items.
   */
  async getCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.wishlistItem.count({
      where: { userId },
    });
    return { count };
  }

  /**
   * Check if a product is saved in customer's wishlist.
   */
  async isSaved(userId: string, productId: string): Promise<{ isSaved: boolean }> {
    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    return { isSaved: !!item };
  }
}

