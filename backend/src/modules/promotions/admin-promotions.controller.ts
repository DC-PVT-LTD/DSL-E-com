import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PromotionsService } from './promotions.service';
import {
  createPromotionSchema,
  CreatePromotionDto,
  updatePromotionSchema,
  UpdatePromotionDto,
  createPromoCodeSchema,
  CreatePromoCodeDto,
  queryPromotionsSchema,
  QueryPromotionsDto,
} from './dto/promotions.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Promotions & Discounts (Admin)')
@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth('bearerAuth')
export class AdminPromotionsController {
  constructor(
    @Inject(PromotionsService)
    private readonly promotionsService: PromotionsService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all promotions with filters, pagination and effective status' })
  @ApiResponse({ status: 200, description: 'Paginated list of promotions' })
  async listPromotions(@Query(createZodPipe(queryPromotionsSchema)) query: QueryPromotionsDto) {
    const result = await this.promotionsService.listPromotions(query);
    return createApiResponse(result, 'Promotions retrieved successfully');
  }

  @Get('reporting/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get overall promotions reporting summary' })
  @ApiResponse({ status: 200, description: 'Promotions reporting metrics' })
  async getReportingSummary() {
    const result = await this.promotionsService.getReportingSummary();
    return createApiResponse(result, 'Reporting summary retrieved successfully');
  }

  @Post('generate-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a unique random promo code' })
  @ApiResponse({ status: 200, description: 'Random unique promo code generated' })
  async generateCode(@Query('prefix') prefix?: string) {
    const code = await this.promotionsService.generateUniquePromoCode(prefix || 'DSL');
    return createApiResponse({ code }, 'Unique promo code generated');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new promotion with codes, products and stacking settings' })
  @ApiResponse({ status: 201, description: 'Promotion created successfully' })
  async createPromotion(
    @Body(createZodPipe(createPromotionSchema)) dto: CreatePromotionDto,
    @Req() req: Request
  ) {
    const adminUserId = (req as any).user?.id;
    const result = await this.promotionsService.createPromotion(dto, adminUserId);
    return createApiResponse(result, 'Promotion created successfully');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get promotion details by ID' })
  @ApiResponse({ status: 200, description: 'Promotion details' })
  async getPromotionById(@Param('id') id: string) {
    const result = await this.promotionsService.getPromotionById(id);
    return createApiResponse(result, 'Promotion details retrieved successfully');
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update promotion settings and eligibility' })
  @ApiResponse({ status: 200, description: 'Promotion updated successfully' })
  async updatePromotion(
    @Param('id') id: string,
    @Body(createZodPipe(updatePromotionSchema)) dto: UpdatePromotionDto,
    @Req() req: Request
  ) {
    const adminUserId = (req as any).user?.id;
    const result = await this.promotionsService.updatePromotion(id, dto, adminUserId);
    return createApiResponse(result, 'Promotion updated successfully');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete draft promotion or safely disable if order history exists' })
  @ApiResponse({ status: 200, description: 'Promotion deleted or disabled' })
  async deletePromotion(@Param('id') id: string, @Req() req: Request) {
    const adminUserId = (req as any).user?.id;
    const result = await this.promotionsService.deletePromotion(id, adminUserId);
    return createApiResponse(result, result.message);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a promotion' })
  @ApiResponse({ status: 200, description: 'Promotion activated' })
  async activatePromotion(@Param('id') id: string) {
    const result = await this.promotionsService.activatePromotion(id);
    return createApiResponse(result, 'Promotion activated successfully');
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a promotion' })
  @ApiResponse({ status: 200, description: 'Promotion deactivated' })
  async deactivatePromotion(@Param('id') id: string) {
    const result = await this.promotionsService.deactivatePromotion(id);
    return createApiResponse(result, 'Promotion deactivated successfully');
  }

  @Post(':id/codes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new promo code to a promotion' })
  @ApiResponse({ status: 201, description: 'Promo code added' })
  async addPromoCode(
    @Param('id') promotionId: string,
    @Body(createZodPipe(createPromoCodeSchema)) dto: CreatePromoCodeDto
  ) {
    const result = await this.promotionsService.addPromoCode(promotionId, dto);
    return createApiResponse(result, 'Promo code added successfully');
  }

  @Get(':id/redemptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get redemption history for a promotion' })
  @ApiResponse({ status: 200, description: 'Promotion redemption records' })
  async getPromotionRedemptions(
    @Param('id') promotionId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const result = await this.promotionsService.getPromotionRedemptions(promotionId, pageNum, limitNum);
    return createApiResponse(result, 'Redemptions retrieved successfully');
  }
}

