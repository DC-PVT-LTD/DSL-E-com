import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiHeader,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CartService } from './cart.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  MergeCartDto,
  AddSchoolPackToCartDto,
  addToCartSchema,
  updateCartItemSchema,
  mergeCartSchema,
  addSchoolPackToCartSchema,
} from './dto/cart.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  /**
   * Helper to extract guest session ID from headers or cookies.
   */
  private getGuestSessionId(req: Request): string | null {
    const headerId = req.headers['x-guest-session-id'];
    if (typeof headerId === 'string' && headerId.trim()) {
      return headerId.trim();
    }
    if (req.cookies && req.cookies['dsl_guest_session']) {
      return req.cookies['dsl_guest_session'];
    }
    return null;
  }

  /**
   * Helper to set the guest session header on response if present.
   */
  private setGuestHeader(res: Response, sessionId?: string | null) {
    if (sessionId) {
      res.setHeader('x-guest-session-id', sessionId);
      res.setHeader('Access-Control-Expose-Headers', 'x-guest-session-id');
    }
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Retrieve current user or guest cart',
    description: 'Returns the authoritative cart with live server-side prices and stock validation.',
  })
  @ApiHeader({
    name: 'x-guest-session-id',
    required: false,
    description: 'Session identifier for anonymous guest carts',
  })
  @ApiBearerAuth('jwt-bearer')
  @ApiCookieAuth('jwt-cookie')
  @ApiResponse({ status: 200, description: 'Cart retrieved successfully' })
  async getCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const guestSessionId = this.getGuestSessionId(req);
    const cart = await this.cartService.getCart(user?.id || null, guestSessionId);

    this.setGuestHeader(res, cart.sessionId);
    return createApiResponse(cart, 'Cart retrieved successfully');
  }

  @Post('items')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add item to cart',
    description: 'Adds a product or variant. Rejects out-of-stock items, invalid variants, and clamps or aggregates duplicate lines.',
  })
  @ApiHeader({
    name: 'x-guest-session-id',
    required: false,
    description: 'Session identifier for anonymous guest carts',
  })
  @ApiBody({ type: AddToCartDto })
  @ApiResponse({ status: 200, description: 'Item added to cart successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or insufficient stock' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(createZodPipe(addToCartSchema)) dto: AddToCartDto,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const guestSessionId = this.getGuestSessionId(req);
    const cart = await this.cartService.addItem(dto, user?.id || null, guestSessionId);

    this.setGuestHeader(res, cart.sessionId);
    return createApiResponse(cart, 'Item added to cart successfully');
  }

  @Post('school-packs')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add customized school pack to cart',
    description: 'Adds customized school pack items with real stock and substitute validation.',
  })
  @ApiHeader({
    name: 'x-guest-session-id',
    required: false,
    description: 'Session identifier for anonymous guest carts',
  })
  @ApiBody({ type: AddSchoolPackToCartDto })
  @ApiResponse({ status: 200, description: 'School pack added to cart successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed, invalid substitute, or insufficient stock' })
  @ApiResponse({ status: 404, description: 'School pack or product not found' })
  async addSchoolPack(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(createZodPipe(addSchoolPackToCartSchema)) dto: AddSchoolPackToCartDto,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const guestSessionId = this.getGuestSessionId(req);
    const cart = await this.cartService.addSchoolPack(dto, user?.id || null, guestSessionId);

    this.setGuestHeader(res, cart.sessionId);
    return createApiResponse(cart, 'School pack added to cart successfully');
  }

  @Patch('items/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Update cart item quantity',
    description: 'Updates line quantity. Validates live database stock and prevents unauthorized modification of other carts.',
  })
  @ApiParam({ name: 'id', description: 'CartItem ID' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, description: 'Cart item quantity updated successfully' })
  @ApiResponse({ status: 400, description: 'Quantity invalid or exceeds available stock' })
  @ApiResponse({ status: 403, description: 'Unauthorized access to cart item' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  async updateItemQuantity(
    @Param('id') itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(createZodPipe(updateCartItemSchema)) dto: UpdateCartItemDto,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const guestSessionId = this.getGuestSessionId(req);
    const cart = await this.cartService.updateItemQuantity(
      itemId,
      dto,
      user?.id || null,
      guestSessionId
    );

    this.setGuestHeader(res, cart.sessionId);
    return createApiResponse(cart, 'Cart item quantity updated successfully');
  }

  @Delete('items/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Remove an item from cart',
    description: 'Removes the specified line item from the active cart.',
  })
  @ApiParam({ name: 'id', description: 'CartItem ID' })
  @ApiResponse({ status: 200, description: 'Cart item removed successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized access to cart item' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  async removeItem(
    @Param('id') itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const guestSessionId = this.getGuestSessionId(req);
    const cart = await this.cartService.removeItem(itemId, user?.id || null, guestSessionId);

    this.setGuestHeader(res, cart.sessionId);
    return createApiResponse(cart, 'Cart item removed successfully');
  }

  @Post('items/batch-delete')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove specific purchased items from cart',
    description: 'Deletes only specified items, leaving remaining items untouched.',
  })
  async removePurchasedItems(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { items: Array<{ productId: string; variantId?: string | null }> },
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const guestSessionId = this.getGuestSessionId(req);
    const cart = await this.cartService.removePurchasedItems(
      body?.items || [],
      user?.id || null,
      guestSessionId
    );

    this.setGuestHeader(res, cart.sessionId);
    return createApiResponse(cart, 'Purchased items removed from cart successfully');
  }

  @Delete()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Clear current cart',
    description: 'Deletes all items in the active cart.',
  })
  @ApiResponse({ status: 200, description: 'Cart cleared successfully' })
  async clearCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    const guestSessionId = this.getGuestSessionId(req);
    const cart = await this.cartService.clearCart(user?.id || null, guestSessionId);

    this.setGuestHeader(res, cart.sessionId);
    return createApiResponse(cart, 'Cart cleared successfully');
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Merge guest cart into authenticated customer cart',
    description: 'Called after customer login or registration to safely combine guest items with existing account cart items.',
  })
  @ApiBearerAuth('jwt-bearer')
  @ApiCookieAuth('jwt-cookie')
  @ApiBody({ type: MergeCartDto })
  @ApiResponse({ status: 200, description: 'Guest cart merged successfully' })
  @ApiResponse({ status: 401, description: 'Customer authentication required' })
  async mergeCart(
    @Body(createZodPipe(mergeCartSchema)) dto: MergeCartDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const cart = await this.cartService.mergeGuestCart(dto, user.id);
    return createApiResponse(cart, 'Guest cart merged successfully');
  }
}

