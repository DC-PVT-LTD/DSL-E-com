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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { productQuerySchema, ProductQueryDto } from './dto/product-query.dto';
import {
  createProductSchema,
  updateProductSchema,
  CreateProductDto,
  UpdateProductDto,
} from './dto/create-product.dto';
import {
  createVariantSchema,
  updateVariantSchema,
  CreateVariantDto,
  UpdateVariantDto,
} from './dto/create-variant.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService
  ) {}

  @ApiTags('Products')
  @Get()
  @ApiOperation({
    summary: 'List products with filtering, search, and pagination',
    description:
      'Public endpoint to query products with pagination, search keywords, category/brand filters, price ranges, and status flags.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of products returned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters or filter values',
  })
  async getProducts(
    @Query(createZodPipe(productQuerySchema)) query: ProductQueryDto
  ) {
    return this.productsService.findAll(query);
  }

  @ApiTags('Products')
  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get product by slug',
    description:
      'Public endpoint to retrieve complete product details including brand, category, and variants by unique URL slug.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Unique URL-friendly slug of the product',
    example: 'atlas-chooty-blue-ballpoint-pen',
  })
  @ApiResponse({
    status: 200,
    description: 'Product details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async getProductBySlug(@Param('slug') slug: string) {
    const product = await this.productsService.findBySlug(slug);
    return createApiResponse(product);
  }

  @ApiTags('Products')
  @Get(':id')
  @ApiOperation({
    summary: 'Get product by ID',
    description:
      'Public endpoint to retrieve complete product details by unique UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product UUID identifier',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Product details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async getProductById(@Param('id') id: string) {
    const product = await this.productsService.findById(id);
    return createApiResponse(product);
  }

  // Management endpoints strictly protected by JwtAuthGuard + RolesGuard
  @ApiTags('Admin API')
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Create a new product (Manager, Admin)',
    description:
      'Creates a new product with pricing, inventory, category, and brand assignments. Requires MANAGER or ADMIN role.',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed on required product fields',
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
    description: 'Conflict - A product with this SKU or slug already exists',
  })
  async createProduct(
    @Body(createZodPipe(createProductSchema)) dto: CreateProductDto,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const product = await this.productsService.create(dto, actor?.id);
    return createApiResponse(product, 'Product created successfully');
  }

  @ApiTags('Admin API')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Update an existing product (Manager, Admin)',
    description:
      'Updates product details, pricing, inventory, categories, or status. Requires MANAGER or ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product UUID identifier',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error on update fields',
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
    description: 'Product not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - SKU or slug collision with existing product',
  })
  async updateProduct(
    @Param('id') id: string,
    @Body(createZodPipe(updateProductSchema)) dto: UpdateProductDto,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const updated = await this.productsService.update(id, dto, actor?.id);
    return createApiResponse(updated, 'Product updated successfully');
  }

  @ApiTags('Admin API')
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Toggle product active status (Staff, Manager, Admin)',
    description:
      'Toggles product between active (published) and inactive (hidden). Requires STAFF, MANAGER, or ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product UUID identifier',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Product status toggled successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (requires STAFF, MANAGER, or ADMIN role)',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async toggleProductStatus(
    @Param('id') id: string,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const updated = await this.productsService.toggleStatus(id, actor?.id);
    return createApiResponse(updated, 'Product status updated successfully');
  }

  @ApiTags('Admin API')
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Deactivate / soft-delete a product (Admin only)',
    description:
      'Deactivates a product from the catalogue. Requires ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product UUID identifier',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Product deactivated successfully',
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
    description: 'Product not found',
  })
  async deleteProduct(
    @Param('id') id: string,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    await this.productsService.delete(id, actor?.id);
    return createApiResponse({ id }, 'Product deactivated successfully');
  }

  // ============================================================================
  // PRODUCT VARIANT ENDPOINTS
  // ============================================================================

  @ApiTags('Products', 'Variants')
  @Get(':productId/variants')
  @ApiOperation({
    summary: 'List variants belonging to a product',
    description: 'Retrieves all active variants configured for a given product.',
  })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'List of product variants returned successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getVariants(@Param('productId') productId: string) {
    const variants = await this.productsService.findVariants(productId);
    return createApiResponse(variants);
  }

  @ApiTags('Products', 'Variants')
  @Get(':productId/variants/:variantId')
  @ApiOperation({
    summary: 'Retrieve variant details by ID',
    description: 'Retrieves details for a specific variant belonging to a product.',
  })
  @ApiParam({ name: 'productId', description: 'Parent product ID' })
  @ApiParam({ name: 'variantId', description: 'Product variant ID' })
  @ApiResponse({ status: 200, description: 'Variant details returned successfully' })
  @ApiResponse({ status: 404, description: 'Product or variant not found' })
  async getVariantById(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string
  ) {
    const variant = await this.productsService.findVariantById(productId, variantId);
    return createApiResponse(variant);
  }

  @ApiTags('Admin API', 'Variants')
  @Post(':productId/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Create a new variant for an existing product (Manager, Admin)',
    description:
      'Creates a variant with specific pricing, attributes, and optional initial stock. Increments parent aggregate stock accordingly.',
  })
  @ApiParam({ name: 'productId', description: 'Parent product ID' })
  @ApiBody({ type: CreateVariantDto })
  @ApiResponse({ status: 201, description: 'Product variant created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires MANAGER or ADMIN role' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Conflict - SKU already exists' })
  async createVariant(
    @Param('productId') productId: string,
    @Body(createZodPipe(createVariantSchema)) dto: CreateVariantDto,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const variant = await this.productsService.createVariant(productId, dto, actor?.id);
    return createApiResponse(variant, 'Product variant created successfully');
  }

  @ApiTags('Admin API', 'Variants')
  @Patch(':productId/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Update variant details (Manager, Admin)',
    description: 'Updates variant name, SKU, price, compareAtPrice, or attributes.',
  })
  @ApiParam({ name: 'productId', description: 'Parent product ID' })
  @ApiParam({ name: 'variantId', description: 'Product variant ID' })
  @ApiBody({ type: UpdateVariantDto })
  @ApiResponse({ status: 200, description: 'Variant updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Product or variant not found' })
  @ApiResponse({ status: 409, description: 'Conflict - SKU already in use' })
  async updateVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body(createZodPipe(updateVariantSchema)) dto: UpdateVariantDto,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const updated = await this.productsService.updateVariant(productId, variantId, dto, actor?.id);
    return createApiResponse(updated, 'Product variant updated successfully');
  }

  @ApiTags('Admin API', 'Variants')
  @Patch(':productId/variants/:variantId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Toggle variant active status (Staff, Manager, Admin)',
    description: 'Toggles a variant between active and inactive.',
  })
  @ApiParam({ name: 'productId', description: 'Parent product ID' })
  @ApiParam({ name: 'variantId', description: 'Product variant ID' })
  @ApiResponse({ status: 200, description: 'Variant status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  async toggleVariantStatus(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    const updated = await this.productsService.toggleVariantStatus(productId, variantId, actor?.id);
    return createApiResponse(updated, 'Variant status updated successfully');
  }

  @ApiTags('Admin API', 'Variants')
  @Delete(':productId/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Deactivate / soft-delete a product variant (Admin only)',
    description: 'Deactivates a variant to prevent data loss. Requires ADMIN role.',
  })
  @ApiParam({ name: 'productId', description: 'Parent product ID' })
  @ApiParam({ name: 'variantId', description: 'Product variant ID' })
  @ApiResponse({ status: 200, description: 'Variant deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  async deleteVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    await this.productsService.deleteVariant(productId, variantId, actor?.id);
    return createApiResponse({ id: variantId }, 'Product variant deactivated successfully');
  }
}
