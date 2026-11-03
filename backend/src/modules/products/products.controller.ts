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
import { ProductsService } from './products.service';
import { productQuerySchema, ProductQueryDto } from './dto/product-query.dto';
import {
  createProductSchema,
  updateProductSchema,
  CreateProductDto,
  UpdateProductDto,
} from './dto/create-product.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService
  ) {}

  @Get()
  async getProducts(
    @Query(createZodPipe(productQuerySchema)) query: ProductQueryDto
  ) {
    return this.productsService.findAll(query);
  }

  @Get('slug/:slug')
  async getProductBySlug(@Param('slug') slug: string) {
    const product = await this.productsService.findBySlug(slug);
    return createApiResponse(product);
  }

  @Get(':id')
  async getProductById(@Param('id') id: string) {
    const product = await this.productsService.findById(id);
    return createApiResponse(product);
  }

  // Management endpoints strictly protected by AdminAuthGuard
  @Post()
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createProduct(
    @Body(createZodPipe(createProductSchema)) dto: CreateProductDto
  ) {
    const product = await this.productsService.create(dto);
    return createApiResponse(product, 'Product created successfully');
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard)
  async updateProduct(
    @Param('id') id: string,
    @Body(createZodPipe(updateProductSchema)) dto: UpdateProductDto
  ) {
    const updated = await this.productsService.update(id, dto);
    return createApiResponse(updated, 'Product updated successfully');
  }

  @Patch(':id/status')
  @UseGuards(AdminAuthGuard)
  async toggleProductStatus(@Param('id') id: string) {
    const updated = await this.productsService.toggleStatus(id);
    return createApiResponse(updated, 'Product status updated successfully');
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  async deleteProduct(@Param('id') id: string) {
    await this.productsService.delete(id);
    return createApiResponse({ id }, 'Product deactivated successfully');
  }
}
