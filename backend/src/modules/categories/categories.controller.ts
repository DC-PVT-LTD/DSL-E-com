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
import { CategoriesService } from './categories.service';
import { categoryQuerySchema, CategoryQueryDto } from './dto/category-query.dto';
import {
  createCategorySchema,
  updateCategorySchema,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/create-category.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { basePaginationSchema, BasePaginationQuery } from '../../common/pagination/pagination.util';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('categories')
export class CategoriesController {
  constructor(
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService
  ) {}

  @Get()
  async getCategories(
    @Query(createZodPipe(categoryQuerySchema)) query: CategoryQueryDto
  ) {
    return this.categoriesService.findAll(query);
  }

  @Get('slug/:slug')
  async getCategoryBySlug(@Param('slug') slug: string) {
    const category = await this.categoriesService.findBySlug(slug);
    return createApiResponse(category);
  }

  @Get(':id')
  async getCategoryById(@Param('id') id: string) {
    const category = await this.categoriesService.findById(id);
    return createApiResponse(category);
  }

  @Get(':id/products')
  async getCategoryProducts(
    @Param('id') id: string,
    @Query(createZodPipe(basePaginationSchema)) query: BasePaginationQuery
  ) {
    return this.categoriesService.findCategoryProducts(id, query);
  }

  // Management endpoints strictly protected by AdminAuthGuard
  @Post()
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body(createZodPipe(createCategorySchema)) dto: CreateCategoryDto
  ) {
    const category = await this.categoriesService.create(dto);
    return createApiResponse(category, 'Category created successfully');
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard)
  async updateCategory(
    @Param('id') id: string,
    @Body(createZodPipe(updateCategorySchema)) dto: UpdateCategoryDto
  ) {
    const updated = await this.categoriesService.update(id, dto);
    return createApiResponse(updated, 'Category updated successfully');
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  async deleteCategory(@Param('id') id: string) {
    await this.categoriesService.delete(id);
    return createApiResponse({ id }, 'Category deleted successfully');
  }
}
