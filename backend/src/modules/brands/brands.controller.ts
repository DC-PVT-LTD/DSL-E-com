import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { brandQuerySchema, BrandQueryDto } from './dto/brand-query.dto';
import {
  createBrandSchema,
  updateBrandSchema,
  CreateBrandDto,
  UpdateBrandDto,
} from './dto/create-brand.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma';
import {
  basePaginationSchema,
  BasePaginationQueryDto,
} from '../../common/pagination/pagination.util';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('brands')
export class BrandsController {
  constructor(
    @Inject(BrandsService)
    private readonly brandsService: BrandsService
  ) {}

  @ApiTags('Brands')
  @Get()
  @ApiOperation({
    summary: 'List brands with search and status filters',
    description:
      'Public endpoint to query brands with search keywords, active status filter, and pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Brands retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
  })
  async getBrands(
    @Query(createZodPipe(brandQuerySchema)) query: BrandQueryDto
  ) {
    return this.brandsService.findAll(query);
  }

  @ApiTags('Admin API', 'Brands')
  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('brands.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Get brand analytics and product count distribution',
    description: 'Returns real database metrics on brand counts, active vs empty brands, and top brands.',
  })
  async getBrandAnalytics() {
    const analytics = await this.brandsService.getAdminAnalytics();
    return createApiResponse(analytics, 'Brand analytics retrieved successfully');
  }

  @ApiTags('Admin API', 'Brands', 'Export')
  @Get('export')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('brands.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Export brands to CSV or Excel',
    description: 'Exports all brands with their product counts to CSV or XLSX format.',
  })
  async exportBrands(
    @Query('format') format: 'csv' | 'xlsx',
    @Query('selectedIds') selectedIdsStr: string,
    @Res() res: Response
  ) {
    const selectedIds = selectedIdsStr ? selectedIdsStr.split(',').filter(Boolean) : undefined;
    const file = await this.brandsService.exportBrands(format || 'xlsx', selectedIds);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @ApiTags('Brands')
  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get brand by slug',
    description:
      'Public endpoint to retrieve brand details by unique URL slug.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Unique URL slug of the brand',
    example: 'atlas',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Brand not found',
  })
  async getBrandBySlug(@Param('slug') slug: string) {
    const brand = await this.brandsService.findBySlug(slug);
    return createApiResponse(brand);
  }

  @ApiTags('Brands')
  @Get(':id')
  @ApiOperation({
    summary: 'Get brand by ID',
    description:
      'Public endpoint to retrieve brand details by unique UUID identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'Brand UUID identifier',
    example: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Brand not found',
  })
  async getBrandById(@Param('id') id: string) {
    const brand = await this.brandsService.findById(id);
    return createApiResponse(brand);
  }

  @ApiTags('Brands')
  @Get(':id/products')
  @ApiOperation({
    summary: 'Get paginated products of a brand',
    description:
      'Public endpoint to retrieve paginated list of active products belonging to the specified brand ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Brand UUID identifier',
    example: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated products retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Brand not found',
  })
  async getBrandProducts(
    @Param('id') id: string,
    @Query(createZodPipe(basePaginationSchema)) query: BasePaginationQueryDto
  ) {
    return this.brandsService.findBrandProducts(id, query);
  }

  // Management endpoints strictly protected by JwtAuthGuard + PermissionsGuard
  @ApiTags('Admin API')
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('brands.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Create a new brand (Manager, Admin)',
    description:
      'Protected endpoint to create a new brand with name, slug, description, logo, and website. Requires MANAGER or ADMIN role.',
  })
  @ApiBody({ type: CreateBrandDto })
  @ApiResponse({
    status: 201,
    description: 'Brand created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (requires MANAGER or ADMIN role)',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Brand with this name or slug already exists',
  })
  async createBrand(
    @Body(createZodPipe(createBrandSchema)) dto: CreateBrandDto,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const brand = await this.brandsService.create(dto, actor?.id);
    return createApiResponse(brand, 'Brand created successfully');
  }

  @ApiTags('Admin API')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('brands.edit')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Update an existing brand (Manager, Admin)',
    description:
      'Protected endpoint to update brand details, logo, website, or active status. Requires MANAGER or ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Brand UUID identifier',
    example: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  @ApiBody({ type: UpdateBrandDto })
  @ApiResponse({
    status: 200,
    description: 'Brand updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (requires MANAGER or ADMIN role)',
  })
  @ApiResponse({
    status: 404,
    description: 'Brand not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Brand slug or name collision',
  })
  async updateBrand(
    @Param('id') id: string,
    @Body(createZodPipe(updateBrandSchema)) dto: UpdateBrandDto,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const updated = await this.brandsService.update(id, dto, actor?.id);
    return createApiResponse(updated, 'Brand updated successfully');
  }

  @ApiTags('Admin API')
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('brands.delete')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Deactivate / soft-delete a brand (Admin only)',
    description:
      'Protected endpoint to deactivate a brand. Brands with active products cannot be deleted. Requires ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Brand UUID identifier',
    example: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand deactivated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires ADMIN role',
  })
  @ApiResponse({
    status: 404,
    description: 'Brand not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Cannot delete brand with active products',
  })
  async deleteBrand(
    @Param('id') id: string,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    await this.brandsService.delete(id, actor?.id);
    return createApiResponse({ id }, 'Brand deactivated successfully');
  }
}
