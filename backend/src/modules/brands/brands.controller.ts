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
import { basePaginationSchema, BasePaginationQuery } from '../../common/pagination/pagination.util';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('brands')
export class BrandsController {
  constructor(
    @Inject(BrandsService)
    private readonly brandsService: BrandsService
  ) {}

  @Get()
  async getBrands(
    @Query(createZodPipe(brandQuerySchema)) query: BrandQueryDto
  ) {
    return this.brandsService.findAll(query);
  }

  @Get('slug/:slug')
  async getBrandBySlug(@Param('slug') slug: string) {
    const brand = await this.brandsService.findBySlug(slug);
    return createApiResponse(brand);
  }

  @Get(':id')
  async getBrandById(@Param('id') id: string) {
    const brand = await this.brandsService.findById(id);
    return createApiResponse(brand);
  }

  @Get(':id/products')
  async getBrandProducts(
    @Param('id') id: string,
    @Query(createZodPipe(basePaginationSchema)) query: BasePaginationQuery
  ) {
    return this.brandsService.findBrandProducts(id, query);
  }

  // Management endpoints strictly protected by AdminAuthGuard
  @Post()
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBrand(
    @Body(createZodPipe(createBrandSchema)) dto: CreateBrandDto
  ) {
    const brand = await this.brandsService.create(dto);
    return createApiResponse(brand, 'Brand created successfully');
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard)
  async updateBrand(
    @Param('id') id: string,
    @Body(createZodPipe(updateBrandSchema)) dto: UpdateBrandDto
  ) {
    const updated = await this.brandsService.update(id, dto);
    return createApiResponse(updated, 'Brand updated successfully');
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  async deleteBrand(@Param('id') id: string) {
    await this.brandsService.delete(id);
    return createApiResponse({ id }, 'Brand deleted successfully');
  }
}
