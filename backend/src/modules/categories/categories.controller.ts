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
  Req,
  NotFoundException,
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
import { CategoriesService } from './categories.service';
import { ConfirmationService } from '../security/confirmation.service';
import { categoryQuerySchema, CategoryQueryDto } from './dto/category-query.dto';
import {
  createCategorySchema,
  updateCategorySchema,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';
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

@Controller('categories')
export class CategoriesController {
  constructor(
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService,
    @Inject(ConfirmationService)
    private readonly confirmationService: ConfirmationService,
  ) {}

  @ApiTags('Categories')
  @Get()
  @ApiOperation({
    summary: 'List categories with optional hierarchical tree structure',
    description:
      'Public endpoint to retrieve categories with search, parent category filtering, active status filter, and optional tree formatting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories returned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
  })
  async getCategories(
    @Query(createZodPipe(categoryQuerySchema)) query: CategoryQueryDto
  ) {
    return this.categoriesService.findAll(query);
  }

  @ApiTags('Categories')
  @Get('tree')
  @ApiOperation({
    summary: 'Get category hierarchy tree',
    description:
      'Public endpoint to retrieve top-level categories nested with their subcategories and combined product counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Category tree retrieved successfully',
  })
  async getCategoryTree() {
    const tree = await this.categoriesService.getCategoryTree();
    return createApiResponse(tree);
  }

  @ApiTags('Admin API', 'Categories')
  @Get('admin/analytics')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('categories.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Get category analytics and distribution metrics',
    description: 'Returns real database metrics on category hierarchy, product usage, and top categories.',
  })
  async getCategoryAnalytics() {
    const analytics = await this.categoriesService.getAdminAnalytics();
    return createApiResponse(analytics, 'Category analytics retrieved successfully');
  }

  @ApiTags('Admin API', 'Categories', 'Export')
  @Get('export')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('categories.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Export categories to CSV or Excel',
    description: 'Exports category hierarchy and product counts to CSV or XLSX format.',
  })
  async exportCategories(
    @Query('format') format: 'csv' | 'xlsx',
    @Query('selectedIds') selectedIdsStr: string,
    @Res() res: Response
  ) {
    const selectedIds = selectedIdsStr ? selectedIdsStr.split(',').filter(Boolean) : undefined;
    const file = await this.categoriesService.exportCategories(format || 'xlsx', selectedIds);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @ApiTags('Categories')
  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get category by slug',
    description:
      'Public endpoint to retrieve category details and subcategories by unique URL slug.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Unique URL slug of the category',
    example: 'pens-and-writing',
  })
  @ApiResponse({
    status: 200,
    description: 'Category details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  async getCategoryBySlug(@Param('slug') slug: string) {
    const category = await this.categoriesService.findBySlug(slug);
    return createApiResponse(category);
  }

  @ApiTags('Categories')
  @Get(':id')
  @ApiOperation({
    summary: 'Get category by ID',
    description:
      'Public endpoint to retrieve category details by unique UUID identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'Category UUID identifier',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @ApiResponse({
    status: 200,
    description: 'Category details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  async getCategoryById(@Param('id') id: string) {
    const category = await this.categoriesService.findById(id);
    return createApiResponse(category);
  }

  @ApiTags('Categories')
  @Get(':id/products')
  @ApiOperation({
    summary: 'Get paginated products in a category',
    description:
      'Public endpoint to retrieve paginated list of active products belonging to the specified category ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Category UUID identifier',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated products retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  async getCategoryProducts(
    @Param('id') id: string,
    @Query(createZodPipe(basePaginationSchema)) query: BasePaginationQueryDto
  ) {
    return this.categoriesService.findCategoryProducts(id, query);
  }

  // Management endpoints strictly protected by JwtAuthGuard + PermissionsGuard
  @ApiTags('Admin API')
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('categories.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Create a new category (Manager, Admin)',
    description:
      'Protected endpoint to create a new product category. Supports parent category assignment for hierarchies. Requires MANAGER or ADMIN role.',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
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
    description: 'Conflict - Category slug already exists',
  })
  async createCategory(
    @Body(createZodPipe(createCategorySchema)) dto: CreateCategoryDto,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const category = await this.categoriesService.create(dto, actor?.id);
    return createApiResponse(category, 'Category created successfully');
  }

  @ApiTags('Admin API')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('categories.edit')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Update an existing category (Manager, Admin)',
    description:
      'Protected endpoint to update category details, parent category, or status. Requires MANAGER or ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Category UUID identifier',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed or circular parent hierarchy',
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
    description: 'Category not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Category slug collision',
  })
  async updateCategory(
    @Param('id') id: string,
    @Body(createZodPipe(updateCategorySchema)) dto: UpdateCategoryDto,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const updated = await this.categoriesService.update(id, dto, actor?.id);
    return createApiResponse(updated, 'Category updated successfully');
  }

  @ApiTags('Admin API')
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('categories.delete')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Deactivate / soft-delete a category (Admin only)',
    description:
      'Protected endpoint to deactivate a category. Categories with active products or subcategories cannot be deleted. Requires ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Category UUID identifier',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @ApiResponse({
    status: 200,
    description: 'Category deactivated successfully',
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
    description: 'Category not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Cannot delete category with active products or children',
  })
  async deleteCategory(
    @Param('id') id: string,
    @Req() req: any,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const category = await this.categoriesService.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.confirmationService.validateConfirmation({
      action: 'DELETE_CATEGORY',
      req,
      targetEntity: 'Category',
      targetId: id,
      expectedValue: category.name,
      actor: {
        id: actor?.id || 'admin',
        email: actor?.email,
        name: actor?.name,
        role: actor?.role,
      },
    });

    await this.categoriesService.delete(id, actor?.id);
    return createApiResponse({ id }, 'Category deleted successfully');
  }
}
