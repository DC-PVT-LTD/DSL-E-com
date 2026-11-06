import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';
import {
  AddWishlistItemDto,
  WishlistResponseDto,
  WishlistItemResponseDto,
  addWishlistItemSchema,
} from './dto/wishlist.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  /**
   * GET /api/v1/wishlist
   * Retrieve current authenticated customer's wishlist.
   */
  @Get()
  @ApiOperation({ summary: "Get customer's saved wishlist" })
  @ApiResponse({ status: 200, description: "Customer's wishlist items with current catalogue data" })
  async getWishlist(@CurrentUser() user: AuthenticatedUser): Promise<WishlistResponseDto> {
    return this.wishlistService.getWishlist(user.id);
  }

  /**
   * GET /api/v1/wishlist/count
   * Retrieve total number of items saved in customer's wishlist.
   */
  @Get('count')
  @ApiOperation({ summary: 'Get total saved items count' })
  @ApiResponse({ status: 200, description: 'Number of wishlist items' })
  async getCount(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    return this.wishlistService.getCount(user.id);
  }

  /**
   * GET /api/v1/wishlist/check/:productId
   * Check if a specific product is in customer's wishlist.
   */
  @Get('check/:productId')
  @ApiOperation({ summary: 'Check if a product is saved' })
  @ApiResponse({ status: 200, description: 'True if product is in wishlist' })
  async isSaved(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string
  ): Promise<{ isSaved: boolean }> {
    return this.wishlistService.isSaved(user.id, productId);
  }

  /**
   * POST /api/v1/wishlist/items
   * Add a product to customer's wishlist.
   */
  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add product to wishlist' })
  @ApiResponse({ status: 200, description: 'Product added or existing item returned' })
  async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body(createZodPipe(addWishlistItemSchema)) dto: AddWishlistItemDto
  ): Promise<WishlistItemResponseDto> {
    return this.wishlistService.addItem(user.id, dto.productId);
  }

  /**
   * DELETE /api/v1/wishlist/items/:productId
   * Remove a product from customer's wishlist.
   */
  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  @ApiResponse({ status: 200, description: 'Product removed from wishlist' })
  async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string
  ): Promise<{ success: boolean; productId: string }> {
    return this.wishlistService.removeItem(user.id, productId);
  }
}
