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
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import {
  createRecommendationRuleSchema,
  updateRecommendationRuleSchema,
  CreateRecommendationRuleDto,
  UpdateRecommendationRuleDto,
} from './dto/recommendation-rule.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';
import { StationeryPurpose } from './recommendations.types';

@ApiTags('Admin Recommendations Management')
@Controller('admin/recommendations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('bearerAuth')
@ApiCookieAuth('dsl_access_token')
export class AdminRecommendationsController {
  constructor(
    @Inject(RecommendationsService)
    private readonly recommendationsService: RecommendationsService
  ) {}

  @Get('rules')
  @RequirePermissions('recommendations.view')
  @ApiOperation({ summary: 'Get all recommendation rules (with optional purpose filter)' })
  @ApiResponse({ status: 200, description: 'List of recommendation rules' })
  getAllRules(@Query('purpose') purpose?: StationeryPurpose) {
    const rules = this.recommendationsService.getAllRules(purpose);
    return createApiResponse(rules);
  }

  @Get('rules/:id')
  @RequirePermissions('recommendations.view')
  @ApiOperation({ summary: 'Get recommendation rule by ID' })
  @ApiResponse({ status: 200, description: 'Recommendation rule details' })
  getRuleById(@Param('id') id: string) {
    const rule = this.recommendationsService.getRuleById(id);
    return createApiResponse(rule);
  }

  @Post('rules')
  @RequirePermissions('recommendations.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new recommendation rule' })
  @ApiResponse({ status: 201, description: 'Rule successfully created' })
  async createRule(
    @Body(createZodPipe(createRecommendationRuleSchema)) dto: CreateRecommendationRuleDto
  ) {
    const created = await this.recommendationsService.createRule(dto);
    return createApiResponse(created);
  }

  @Patch('rules/:id')
  @RequirePermissions('recommendations.manage')
  @ApiOperation({ summary: 'Update an existing recommendation rule' })
  @ApiResponse({ status: 200, description: 'Rule successfully updated' })
  async updateRule(
    @Param('id') id: string,
    @Body(createZodPipe(updateRecommendationRuleSchema)) dto: UpdateRecommendationRuleDto
  ) {
    const updated = await this.recommendationsService.updateRule(id, dto);
    return createApiResponse(updated);
  }

  @Delete('rules/:id')
  @RequirePermissions('recommendations.manage')
  @ApiOperation({ summary: 'Delete a recommendation rule' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  deleteRule(@Param('id') id: string) {
    const result = this.recommendationsService.deleteRule(id);
    return createApiResponse(result);
  }

  @Patch('rules/:id/toggle')
  @RequirePermissions('recommendations.manage')
  @ApiOperation({ summary: 'Toggle active status of a recommendation rule' })
  @ApiResponse({ status: 200, description: 'Rule status toggled' })
  toggleRule(@Param('id') id: string, @Body('isActive') isActive?: boolean) {
    const toggled = this.recommendationsService.toggleRuleStatus(id, isActive);
    return createApiResponse(toggled);
  }
}

