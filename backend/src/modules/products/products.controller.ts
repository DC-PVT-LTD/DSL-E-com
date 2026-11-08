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
  BadRequestException,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductImportService } from './product-import.service';
import {
  ImportPreviewRow,
  ExecuteImportDto,
  executeImportSchema,
} from './dto/product-import.dto';
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
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
    @Inject(ProductImportService)
    private readonly productImportService: ProductImportService
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
  @ApiTags('Admin API', 'Products', 'SKU')
  @Get('generate-sku')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Generate an automatic product SKU preview',
    description: 'Generates the next sequential unique SKU for a given category and brand.',
  })
  async generateProductSku(
    @Query('categoryId') categoryId: string,
    @Query('brandId') brandId: string,
  ) {
    if (!categoryId || !brandId) {
      throw new BadRequestException('Both categoryId and brandId are required');
    }
    const sku = await this.productsService.previewProductSku(categoryId, brandId);
    return createApiResponse({ sku }, 'Product SKU preview generated successfully');
  }

  @ApiTags('Admin API', 'Products', 'Import')
  @Get('import/template/excel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('products.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Download product import Excel template',
    description:
      'Generates and streams a standardized Excel (.xlsx) spreadsheet with column headers, sample data, and field instructions.',
  })
  async downloadExcelTemplate(@Res() res: Response) {
    const buffer = await this.productImportService.generateTemplate('xlsx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="dsl-product-import-template.xlsx"'
    );
    res.send(buffer);
  }

  @ApiTags('Admin API', 'Products', 'Import')
  @Get('import/template/csv')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('products.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Download product import CSV template',
    description:
      'Generates and streams a standardized CSV (.csv) template with column headers and sample data.',
  })
  async downloadCsvTemplate(@Res() res: Response) {
    const buffer = await this.productImportService.generateTemplate('csv');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="dsl-product-import-template.csv"'
    );
    res.send(buffer);
  }

  @ApiTags('Admin API', 'Products', 'Import')
  @Post('import/preview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('products.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Preview and validate Excel/CSV product import',
    description:
      'Parses and validates product rows against database categories, brands, variants, and GlobalSku uniqueness without modifying database.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel (.xlsx, .xls) or CSV (.csv) file up to 10MB',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    })
  )
  async previewImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor?: AuthenticatedUser
  ) {
    if (!file) {
      throw new BadRequestException('Please provide a file to import (.xlsx, .xls, .csv).');
    }
    const result = await this.productImportService.parseAndValidate(file, actor);
    return createApiResponse(result, 'Product import file parsed and validated successfully.');
  }

  @ApiTags('Admin API', 'Products', 'Import')
  @Post('import/execute')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('products.import')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Execute validated product import batch',
    description:
      'Atomically executes an import preview in 50-row chunks with idempotency, lease locking, stock adjustment, and GlobalSku registry synchronization.',
  })
  async executeImport(
    @Body(createZodPipe(executeImportSchema)) dto: ExecuteImportDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const result = await this.productImportService.executeImport(actor, dto);
    return createApiResponse(result, 'Product import execution completed.');
  }

  @ApiTags('Admin API', 'Products', 'Import')
  @Get('import/history')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('products.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'List product import execution history',
    description:
      'Retrieves a paginated list of previous product import batches with progress and status.',
  })
  async getImportHistory(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const result = await this.productImportService.getImportHistory(actor, {
      page: pageNum,
      limit: limitNum,
    });
    return createApiResponse(result);
  }

  @ApiTags('Admin API', 'Products', 'Import')
  @Get('import/batch/:batchId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('products.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Get import batch status and row results',
    description: 'Retrieves status, progress counters, and row results for a specific import batch.',
  })
  async getBatchStatus(
    @Param('batchId') batchId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const result = await this.productImportService.getBatchStatus(batchId, actor);
    return createApiResponse(result);
  }

  @ApiTags('Admin API', 'Products', 'Import')
  @Get('import/batch/:batchId/error-report')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('products.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Download error report for an import batch',
    description:
      'Streams a CSV or Excel error report containing all failed rows for the specified batch.',
  })
  async downloadBatchErrorReport(
    @Param('batchId') batchId: string,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response
  ) {
    const buffer = await this.productImportService.getBatchErrorReport(
      batchId,
      actor,
      format === 'xlsx' ? 'xlsx' : 'csv'
    );
    const contentType =
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv';
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="batch-${batchId}-errors.${ext}"`
    );
    res.send(buffer);
  }

  @ApiTags('Admin API', 'Products', 'Import')
  @Post('import/error-report')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('products.view')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Download error report for invalid import rows',
    description:
      'Generates a downloadable CSV or Excel report highlighting failed rows with exact validation error explanations.',
  })
  async downloadErrorReport(
    @Body('rows') rows: ImportPreviewRow[],
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Res() res: Response
  ) {
    if (!rows || !Array.isArray(rows)) {
      throw new BadRequestException('Invalid payload: "rows" array is required.');
    }
    const buffer = await this.productImportService.generateErrorReport(
      rows,
      format === 'xlsx' ? 'xlsx' : 'csv'
    );
    if (format === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="dsl-import-validation-report.xlsx"'
      );
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="dsl-import-validation-report.csv"'
      );
    }
    res.send(buffer);
  }

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

  @ApiTags('Admin API', 'Variants', 'SKU')
  @Get(':productId/variants/generate-sku')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiParam({ name: 'productId', description: 'Parent product ID' })
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Generate an automatic variant SKU preview',
    description: 'Generates the next sequential or color-coded unique variant SKU.',
  })
  async generateVariantSku(
    @Param('productId') productId: string,
    @Query('color') color?: string,
  ) {
    const sku = await this.productsService.generateVariantSku(productId, color);
    return createApiResponse({ sku }, 'Variant SKU generated successfully');
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
