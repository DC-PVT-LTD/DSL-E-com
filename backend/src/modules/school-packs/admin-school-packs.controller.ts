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
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { SchoolPacksService } from './school-packs.service';
import {
  createSchoolPackSchema,
  updateSchoolPackSchema,
  CreateSchoolPackDto,
  UpdateSchoolPackDto,
} from './dto/create-school-pack.dto';
import {
  schoolPackQuerySchema,
  SchoolPackQueryDto,
} from './dto/school-pack-query.dto';
import {
  schoolPackConfigSchema,
  SchoolPackConfigDto,
} from './dto/school-pack-config.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Admin School Packs')
@Controller('admin/school-packs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth('bearerAuth')
@ApiCookieAuth('dsl_access_token')
export class AdminSchoolPacksController {
  constructor(
    @Inject(SchoolPacksService) private readonly schoolPacksService: SchoolPacksService
  ) {}

  @Get('config/grades-tiers')
  @ApiOperation({ summary: 'Get current grade and tier configuration for admin' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved' })
  async getConfig() {
    const config = this.schoolPacksService.getConfig();
    return createApiResponse(config);
  }

  @Patch('config/grades-tiers')
  @ApiOperation({ summary: 'Update supported grade groups and tiers' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  async updateConfig(
    @Body(createZodPipe(schoolPackConfigSchema)) dto: SchoolPackConfigDto
  ) {
    const updated = this.schoolPacksService.updateConfig(dto);
    return createApiResponse(updated);
  }

  @Get()
  @ApiOperation({ summary: 'List all school packs (including inactive) with filtering' })
  @ApiResponse({ status: 200, description: 'Packs retrieved successfully' })
  async findAll(@Query(createZodPipe(schoolPackQuerySchema)) query: SchoolPackQueryDto) {
    return this.schoolPacksService.findAll(query, true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complete school pack details by ID' })
  @ApiParam({ name: 'id', description: 'School pack ID' })
  @ApiResponse({ status: 200, description: 'Pack details retrieved' })
  async findOne(@Param('id') id: string) {
    const pack = await this.schoolPacksService.findOne(id, true);
    return createApiResponse(pack);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new School Pack' })
  @ApiResponse({ status: 201, description: 'School Pack created successfully' })
  async create(
    @Body(createZodPipe(createSchoolPackSchema)) dto: CreateSchoolPackDto
  ) {
    const pack = await this.schoolPacksService.create(dto);
    return createApiResponse(pack);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing School Pack' })
  @ApiParam({ name: 'id', description: 'School pack ID' })
  @ApiResponse({ status: 200, description: 'School Pack updated successfully' })
  async update(
    @Param('id') id: string,
    @Body(createZodPipe(updateSchoolPackSchema)) dto: UpdateSchoolPackDto
  ) {
    const pack = await this.schoolPacksService.update(id, dto);
    return createApiResponse(pack);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle school pack publication status' })
  @ApiParam({ name: 'id', description: 'School pack ID' })
  @ApiResponse({ status: 200, description: 'Pack status updated' })
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive?: boolean
  ) {
    const pack = await this.schoolPacksService.toggleStatus(id, isActive);
    return createApiResponse(pack);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a school pack' })
  @ApiParam({ name: 'id', description: 'School pack ID' })
  @ApiResponse({ status: 200, description: 'Pack deleted successfully' })
  async delete(@Param('id') id: string) {
    const result = await this.schoolPacksService.delete(id);
    return createApiResponse(result);
  }
}
