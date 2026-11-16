import {
  Controller,
  Get,
  Query,
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
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  reportQuerySchema,
  ReportQueryDto,
  DashboardKpisResponse,
} from './dto/dashboard-query.dto';

@ApiTags('Admin API', 'Dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
@ApiCookieAuth('dsl_access_token')
@ApiBearerAuth('bearerAuth')
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboardService: DashboardService
  ) {}

  @Get('kpis')
  @RequirePermissions('dashboard.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get executive admin dashboard KPIs and operational metrics',
    description:
      'Returns period-filtered financial metrics (for ADMIN and MANAGER), total orders, pending fulfillment queue, low-stock inventory alerts, top-selling products, and recent orders with Asia/Colombo calendar boundaries.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing session token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer or unauthorized role',
  })
  async getDashboardKpis(
    @Query(createZodPipe(reportQuerySchema)) query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<DashboardKpisResponse> {
    return this.dashboardService.getDashboardKpis(query, user.role as UserRole);
  }
}
