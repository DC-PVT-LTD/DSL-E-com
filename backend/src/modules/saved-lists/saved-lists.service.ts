import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SavedListSummaryResponseDto,
  SavedListDetailResponseDto,
  SavedListItemResponseDto,
  ListAvailabilityResponseDto,
  ItemAvailabilityDto,
} from './dto/saved-list.dto';

@Injectable()
export class SavedListsService {
  private readonly logger = new Logger(SavedListsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to ensure the list belongs to the authenticated customer.
   */
  private async findOwnedList(userId: string, listId: string) {
    const list = await this.prisma.savedList.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new NotFoundException(`Saved list with ID "${listId}" not found`);
    }

    return list;
  }

  /**
   * List all saved lists for the authenticated customer.
   */
  async getLists(userId: string): Promise<SavedListSummaryResponseDto[]> {
    const lists = await this.prisma.savedList.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                priceCents: true,
                images: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return lists.map((list) => {
      let estimatedTotalCents = 0;
      const previewImages: string[] = [];

      for (const item of list.items) {
        if (item.product?.isActive) {
          estimatedTotalCents += (item.product.priceCents || 0) * item.quantity;
        }
        if (item.product?.images?.[0] && previewImages.length < 4) {
          previewImages.push(item.product.images[0]);
        }
      }

      return {
        id: list.id,
        name: list.name,
        itemCount: list.items.length,
        estimatedTotalCents,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
        previewImages,
      };
    });
  }

  /**
   * Create a new saved list for the authenticated customer.
   */
  async createList(userId: string, name: string): Promise<SavedListSummaryResponseDto> {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('List name cannot be blank');
    }

    const list = await this.prisma.savedList.create({
      data: {
        userId,
        name: trimmedName,
      },
    });

    this.logger.log(`Customer ${userId} created saved list "${trimmedName}" (${list.id})`);

    return {
      id: list.id,
      name: list.name,
      itemCount: 0,
      estimatedTotalCents: 0,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      previewImages: [],
    };
  }

  /**
   * Retrieve single list with all product items populated with current catalogue info.
   */
  async getListById(userId: string, listId: string): Promise<SavedListDetailResponseDto> {
    const list = await this.prisma.savedList.findFirst({
      where: {
        id: listId,
        userId,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!list) {
      throw new NotFoundException(`Saved list with ID "${listId}" not found`);
    }

    let estimatedTotalCents = 0;
    const items: SavedListItemResponseDto[] = list.items.map((item) => {
      if (item.product.isActive) {
        estimatedTotalCents += item.product.priceCents * item.quantity;
      }

      return {
        id: item.id,
        savedListId: item.savedListId,
        productId: item.productId,
        quantity: item.quantity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
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
    });

    return {
      id: list.id,
      name: list.name,
      itemCount: items.length,
      estimatedTotalCents,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      items,
    };
  }

  /**
   * Rename an existing saved list.
   */
  async renameList(userId: string, listId: string, name: string): Promise<{ id: string; name: string }> {
    await this.findOwnedList(userId, listId);

    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('List name cannot be blank');
    }

    const updated = await this.prisma.savedList.update({
      where: { id: listId },
      data: { name: trimmedName },
    });

    this.logger.log(`Customer ${userId} renamed list ${listId} to "${trimmedName}"`);
    return { id: updated.id, name: updated.name };
  }

  /**
   * Delete a saved list and its items.
   */
  async deleteList(userId: string, listId: string): Promise<{ success: boolean; listId: string }> {
    await this.findOwnedList(userId, listId);

    await this.prisma.savedList.delete({
      where: { id: listId },
    });

    this.logger.log(`Customer ${userId} deleted saved list ${listId}`);
    return { success: true, listId };
  }

  /**
   * Add a product to a saved list with customized quantity.
   * If product is already in the list, increment the existing quantity safely.
   */
  async addItem(
    userId: string,
    listId: string,
    productId: string,
    quantity: number = 1
  ): Promise<SavedListItemResponseDto> {
    await this.findOwnedList(userId, listId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        brand: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    const qtyToAdd = Math.max(1, Math.floor(quantity || 1));

    // Check if item already exists in this list
    const existingItem = await this.prisma.savedListItem.findUnique({
      where: {
        savedListId_productId: {
          savedListId: listId,
          productId,
        },
      },
    });

    let savedItem;
    if (existingItem) {
      savedItem = await this.prisma.savedListItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + qtyToAdd,
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
    } else {
      savedItem = await this.prisma.savedListItem.create({
        data: {
          savedListId: listId,
          productId,
          quantity: qtyToAdd,
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
    }

    // Touch list updatedAt
    await this.prisma.savedList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(
      `Customer ${userId} added product ${productId} (qty: ${qtyToAdd}) to list ${listId}`
    );

    return {
      id: savedItem.id,
      savedListId: savedItem.savedListId,
      productId: savedItem.productId,
      quantity: savedItem.quantity,
      createdAt: savedItem.createdAt,
      updatedAt: savedItem.updatedAt,
      product: {
        id: savedItem.product.id,
        name: savedItem.product.name,
        slug: savedItem.product.slug,
        sku: savedItem.product.sku,
        priceCents: savedItem.product.priceCents,
        compareAtPriceCents: savedItem.product.compareAtPriceCents,
        stockQuantity: savedItem.product.stockQuantity,
        isActive: savedItem.product.isActive,
        images: savedItem.product.images || [],
        categoryName: savedItem.product.category?.name,
        brandName: savedItem.product.brand?.name,
      },
    };
  }

  /**
   * Update the quantity of an item in a saved list.
   */
  async updateItemQuantity(
    userId: string,
    listId: string,
    itemId: string,
    quantity: number
  ): Promise<SavedListItemResponseDto> {
    await this.findOwnedList(userId, listId);

    const item = await this.prisma.savedListItem.findFirst({
      where: {
        id: itemId,
        savedListId: listId,
      },
    });

    if (!item) {
      throw new NotFoundException(`List item with ID "${itemId}" not found in list`);
    }

    const validatedQty = Math.max(1, Math.floor(quantity));

    const updated = await this.prisma.savedListItem.update({
      where: { id: itemId },
      data: { quantity: validatedQty },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
      },
    });

    // Touch list updatedAt
    await this.prisma.savedList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
    });

    return {
      id: updated.id,
      savedListId: updated.savedListId,
      productId: updated.productId,
      quantity: updated.quantity,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      product: {
        id: updated.product.id,
        name: updated.product.name,
        slug: updated.product.slug,
        sku: updated.product.sku,
        priceCents: updated.product.priceCents,
        compareAtPriceCents: updated.product.compareAtPriceCents,
        stockQuantity: updated.product.stockQuantity,
        isActive: updated.product.isActive,
        images: updated.product.images || [],
        categoryName: updated.product.category?.name,
        brandName: updated.product.brand?.name,
      },
    };
  }

  /**
   * Remove an item from a saved list.
   */
  async removeItem(
    userId: string,
    listId: string,
    itemId: string
  ): Promise<{ success: boolean; itemId: string }> {
    await this.findOwnedList(userId, listId);

    const item = await this.prisma.savedListItem.findFirst({
      where: {
        id: itemId,
        savedListId: listId,
      },
    });

    if (!item) {
      throw new NotFoundException(`List item with ID "${itemId}" not found in list`);
    }

    await this.prisma.savedListItem.delete({
      where: { id: itemId },
    });

    // Touch list updatedAt
    await this.prisma.savedList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
    });

    this.logger.log(`Customer ${userId} removed item ${itemId} from list ${listId}`);
    return { success: true, itemId };
  }

  /**
   * Check live stock availability of all items in a saved list before adding to cart.
   */
  async checkAvailability(userId: string, listId: string): Promise<ListAvailabilityResponseDto> {
    const list = await this.prisma.savedList.findFirst({
      where: {
        id: listId,
        userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!list) {
      throw new NotFoundException(`Saved list with ID "${listId}" not found`);
    }

    let availableCount = 0;
    let outOfStockCount = 0;
    let partialCount = 0;

    const items: ItemAvailabilityDto[] = list.items.map((item) => {
      const active = item.product.isActive;
      const stock = active ? Math.max(0, item.product.stockQuantity) : 0;
      const isAvailable = active && stock >= item.quantity;
      const isPartial = active && stock > 0 && stock < item.quantity;
      const isOut = !active || stock === 0;

      if (isAvailable) {
        availableCount++;
      } else if (isPartial) {
        partialCount++;
      } else {
        outOfStockCount++;
      }

      return {
        itemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        requestedQuantity: item.quantity,
        availableStock: stock,
        isActive: active,
        isAvailable,
        isPartial,
        priceCents: item.product.priceCents,
        lineTotalCents: item.product.priceCents * item.quantity,
      };
    });

    const canAddAny = items.some((item) => item.isActive && item.availableStock > 0);

    return {
      listId: list.id,
      listName: list.name,
      totalItems: items.length,
      availableCount,
      outOfStockCount,
      partialCount,
      canAddAny,
      items,
    };
  }
}

