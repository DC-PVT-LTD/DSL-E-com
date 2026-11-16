import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import {
  createBannerSchema,
  CreateBannerDto,
  updateBannerSchema,
  UpdateBannerDto,
  reorderBannersSchema,
  ReorderBannersDto,
  queryBannersSchema,
  QueryBannersDto,
} from './dto/banner.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Banners (Admin)')
@Controller('admin/banners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('bearerAuth')
export class AdminBannersController {
  constructor(
    @Inject(BannersService)
    private readonly bannersService: BannersService
  ) {}

  @Get()
  @RequirePermissions('banners.view')
  @ApiOperation({ summary: 'List all banners with filter and search' })
  @ApiResponse({ status: 200, description: 'List of banners returned' })
  async getAllBanners(
    @Query(createZodPipe(queryBannersSchema)) query: QueryBannersDto
  ) {
    const banners = await this.bannersService.getAdminBanners(query);
    return createApiResponse(banners, 'Banners retrieved successfully');
  }

  @Get(':id')
  @RequirePermissions('banners.view')
  @ApiOperation({ summary: 'Get a banner by ID' })
  @ApiResponse({ status: 200, description: 'Banner returned' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  async getBannerById(@Param('id') id: string) {
    const banner = await this.bannersService.getBannerById(id);
    return createApiResponse(banner, 'Banner retrieved successfully');
  }

  @Post()
  @RequirePermissions('banners.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new banner' })
  @ApiResponse({ status: 201, description: 'Banner created successfully' })
  async createBanner(
    @Body(createZodPipe(createBannerSchema)) dto: CreateBannerDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const banner = await this.bannersService.createBanner(dto, user.id);
    return createApiResponse(banner, 'Banner created successfully');
  }

  @Patch('reorder')
  @RequirePermissions('banners.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder banners in bulk' })
  @ApiResponse({ status: 200, description: 'Banners reordered successfully' })
  async reorderBanners(
    @Body(createZodPipe(reorderBannersSchema)) dto: ReorderBannersDto
  ) {
    const result = await this.bannersService.reorderBanners(dto);
    return createApiResponse(result, result.message);
  }

  @Patch(':id')
  @RequirePermissions('banners.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing banner' })
  @ApiResponse({ status: 200, description: 'Banner updated successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  async updateBanner(
    @Param('id') id: string,
    @Body(createZodPipe(updateBannerSchema)) dto: UpdateBannerDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const banner = await this.bannersService.updateBanner(id, dto, user.id);
    return createApiResponse(banner, 'Banner updated successfully');
  }

  @Post(':id/duplicate')
  @RequirePermissions('banners.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate an existing banner' })
  @ApiResponse({ status: 201, description: 'Banner duplicated successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  async duplicateBanner(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const banner = await this.bannersService.duplicateBanner(id, user.id);
    return createApiResponse(banner, 'Banner duplicated successfully');
  }

  @Delete(':id')
  @RequirePermissions('banners.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a banner by ID' })
  @ApiResponse({ status: 200, description: 'Banner deleted successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  async deleteBanner(@Param('id') id: string) {
    const result = await this.bannersService.deleteBanner(id);
    return createApiResponse(result, result.message);
  }
}

