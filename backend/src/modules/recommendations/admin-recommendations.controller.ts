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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';
import { StationeryPurpose } from './recommendations.types';

@ApiTags('Admin Recommendations Management')
@Controller('admin/recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiBearerAuth('bearerAuth')
@ApiCookieAuth('dsl_access_token')
export class AdminRecommendationsController {
  constructor(
    @Inject(RecommendationsService)
    private readonly recommendationsService: RecommendationsService
  ) {}

  @Get('rules')
  @ApiOperation({ summary: 'Get all recommendation rules (with optional purpose filter)' })
  @ApiResponse({ status: 200, description: 'List of recommendation rules' })
  getAllRules(@Query('purpose') purpose?: StationeryPurpose) {
    const rules = this.recommendationsService.getAllRules(purpose);
    return createApiResponse(rules);
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get recommendation rule by ID' })
  @ApiResponse({ status: 200, description: 'Recommendation rule details' })
  getRuleById(@Param('id') id: string) {
    const rule = this.recommendationsService.getRuleById(id);
    return createApiResponse(rule);
  }

  @Post('rules')
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
  @ApiOperation({ summary: 'Delete a recommendation rule' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  deleteRule(@Param('id') id: string) {
    const result = this.recommendationsService.deleteRule(id);
    return createApiResponse(result);
  }

  @Patch('rules/:id/toggle')
  @ApiOperation({ summary: 'Toggle active status of a recommendation rule' })
  @ApiResponse({ status: 200, description: 'Rule status toggled' })
  toggleRule(@Param('id') id: string, @Body('isActive') isActive?: boolean) {
    const toggled = this.recommendationsService.toggleRuleStatus(id, isActive);
    return createApiResponse(toggled);
  }
}

