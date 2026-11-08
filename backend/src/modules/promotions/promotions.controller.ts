import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { PromotionsService } from './promotions.service';
import {
  validatePromoCodeSchema,
  ValidatePromoCodeDto,
} from './dto/promotions.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('Promotions & Discounts (Customer)')
@Controller('promotions')
@UseGuards(OptionalJwtAuthGuard)
export class PromotionsController {
  constructor(
    @Inject(PromotionsService)
    private readonly promotionsService: PromotionsService
  ) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate promo code against current cart items & school packs',
    description:
      'Performs server-side authoritative validation of dates, status, spend requirements, usage limits, and school pack stacking rules.',
  })
  @ApiResponse({ status: 200, description: 'Promotion validation outcome' })
  async validatePromoCode(
    @Body(createZodPipe(validatePromoCodeSchema)) dto: ValidatePromoCodeDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const userId = user?.id || null;
    const customerEmail = user?.email || null;

    const result = await this.promotionsService.calculateAuthoritativeDiscount(
      dto.code,
      dto.items,
      dto.packSelections,
      userId,
      customerEmail
    );

    return createApiResponse(result, result.message);
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply promo code to cart/checkout session',
  })
  @ApiResponse({ status: 200, description: 'Promotion applied' })
  async applyPromoCode(
    @Body(createZodPipe(validatePromoCodeSchema)) dto: ValidatePromoCodeDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const userId = user?.id || null;
    const customerEmail = user?.email || null;

    const result = await this.promotionsService.calculateAuthoritativeDiscount(
      dto.code,
      dto.items,
      dto.packSelections,
      userId,
      customerEmail
    );

    return createApiResponse(result, result.message);
  }

  @Post('remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove applied promo code',
  })
  @ApiResponse({ status: 200, description: 'Promotion removed' })
  async removePromoCode() {
    return createApiResponse({ removed: true }, 'Promo code removed successfully');
  }
}

