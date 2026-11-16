import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
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
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { UserRole } from '../../generated/prisma';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  reportQuerySchema,
  ReportQueryDto,
} from './dto/report-query.dto';

@ApiTags('Admin API', 'Reports')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@ApiCookieAuth('dsl_access_token')
@ApiBearerAuth('bearerAuth')
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService
  ) {}

  @Get('summary')
  @RequirePermissions('reports.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get financial and executive report summary',
    description:
      'Calculates Gross Sales, Net Revenue, completed refunds, AOV, cancellation reconciliation, and distributions with Asia/Colombo calendar boundaries.',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary financial metrics retrieved successfully',
  })
  async getSummary(
    @Query(createZodPipe(reportQuerySchema)) query: ReportQueryDto
  ) {
    const data = await this.reportsService.getSummary(query);
    return {
      success: true,
      data,
      message: 'Report summary retrieved successfully',
    };
  }

  @Get('sales')
  @RequirePermissions('reports.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get detailed sales performance report with daily breakdown',
    description:
      'Provides daily sales trends in Asia/Colombo calendar buckets, payment methods, district distributions, and recent sales orders.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed sales report retrieved successfully',
  })
  async getSalesReport(
    @Query(createZodPipe(reportQuerySchema)) query: ReportQueryDto
  ) {
    const data = await this.reportsService.getSalesReport(query);
    return {
      success: true,
      data,
      message: 'Sales report retrieved successfully',
    };
  }

  @Get('export')
  @RequirePermissions('reports.export')
  @ApiOperation({
    summary: 'Export sales and financial report to Excel (.xlsx) or CSV',
    description:
      'Streams a multi-worksheet XLSX or CSV document adhering to authoritative financial contract rules and formula sanitization.',
  })
  async exportReport(
    @Query(createZodPipe(reportQuerySchema)) query: ReportQueryDto,
    @Res() res: Response
  ) {
    const format = query.format || 'xlsx';
    await this.reportsService.exportReport(query, format, res);
  }
}

