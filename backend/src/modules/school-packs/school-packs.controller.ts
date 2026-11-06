import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UsePipes,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SchoolPacksService } from './school-packs.service';
import {
  schoolPackQuerySchema,
  SchoolPackQueryDto,
} from './dto/school-pack-query.dto';
import {
  calculateSchoolPackSchema,
  CalculateSchoolPackDto,
} from './dto/calculate-school-pack.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('School Packs')
@Controller('school-packs')
export class SchoolPacksController {
  constructor(
    @Inject(SchoolPacksService) private readonly schoolPacksService: SchoolPacksService
  ) {}

  @Get('config/grades-tiers')
  @ApiOperation({
    summary: 'Get active grade groups and tiers configuration',
    description: 'Returns supported grade groups and tiers for storefront navigation and filtering.',
  })
  @ApiResponse({ status: 200, description: 'Active configuration retrieved successfully' })
  async getConfig() {
    const config = this.schoolPacksService.getConfig();
    return createApiResponse(config);
  }

  @Get()
  @ApiOperation({
    summary: 'List active school packs with stock indicators and filters',
    description: 'Retrieves published school packs filtered by grade group, tier, or keyword.',
  })
  @ApiResponse({ status: 200, description: 'List of school packs retrieved successfully' })
  async findAll(@Query(createZodPipe(schoolPackQuerySchema)) query: SchoolPackQueryDto) {
    return this.schoolPacksService.findAll(query, false);
  }

  @Get(':idOrSlug')
  @ApiOperation({
    summary: 'Get school pack details by ID or Slug',
    description: 'Retrieves complete school pack details including component products, substitutes, and live stock.',
  })
  @ApiParam({ name: 'idOrSlug', description: 'School pack database ID or unique URL slug' })
  @ApiResponse({ status: 200, description: 'School pack details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'School pack not found or inactive' })
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    const pack = await this.schoolPacksService.findOne(idOrSlug, false);
    return createApiResponse(pack);
  }

  @Post(':idOrSlug/calculate')
  @ApiOperation({
    summary: 'Calculate live pricing and stock for customized pack components',
    description: 'Computes authoritative subtotal, discount, and component breakdown based on client customizations.',
  })
  @ApiParam({ name: 'idOrSlug', description: 'School pack ID or slug' })
  @ApiResponse({ status: 200, description: 'Calculated pricing breakdown' })
  async calculateCustomized(
    @Param('idOrSlug') idOrSlug: string,
    @Body(createZodPipe(calculateSchoolPackSchema)) dto: CalculateSchoolPackDto
  ) {
    const calculated = await this.schoolPacksService.calculateCustomized(idOrSlug, dto);
    return createApiResponse(calculated);
  }
}
