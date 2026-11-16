import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLogQueryDto, auditLogQuerySchema } from './dto/audit-query.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { RequireSuperAdmin } from '../admin/roles/decorators/require-super-admin.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Admin API', 'Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN)
@RequirePermissions('audit_logs.view')
@ApiBearerAuth('bearerAuth')
@ApiCookieAuth('dsl_access_token')
export class AuditController {
  constructor(private readonly auditService: AuditService) { }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get audit volume summary metrics (Admin only)',
    description:
      'Returns aggregate counts of general and order audit events, and total events recorded today in Asia/Colombo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary audit metrics retrieved successfully',
  })
  async getSummary() {
    const summary = await this.auditService.getSummary();
    return {
      success: true,
      data: summary,
      message: 'Audit log summary metrics retrieved successfully',
    };
  }

  @Get('admin-activities')
  @RequireSuperAdmin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List private administrator activity logs with before/after state diffs (Super Admin only)',
  })
  async getAdminActivities(@Query() query: any) {
    const result = await this.auditService.findAllAdminActivities(query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'Administrator activity logs retrieved successfully',
    };
  }

  @Get('admin-activities/export')
  @RequireSuperAdmin()
  @ApiOperation({
    summary: 'Export private administrator activity logs to CSV (Super Admin only)',
  })
  async exportAdminActivities(@Query() query: any, @Res() res: any) {
    const csv = await this.auditService.exportActivitiesCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admin-activity-logs.csv"');
    return res.send(csv);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List paginated unified audit logs (Admin only)',
    description:
      'Protected administrative endpoint to retrieve unified audit logs from AuditLog and OrderAuditLog with filtering and global sorting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit logs retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (requires ADMIN role)',
  })
  async getAuditLogs(
    @Query(createZodPipe(auditLogQuerySchema)) query: AuditLogQueryDto
  ) {
    return this.auditService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get single audit log entry by ID (Admin only)',
    description:
      'Retrieves full audit entry details and structured metadata with sensitive fields redacted.',
  })
  @ApiParam({ name: 'id', description: 'Audit log entry ID' })
  @ApiQuery({ name: 'source', required: false, enum: ['AUDIT_LOG', 'ORDER_AUDIT_LOG'] })
  @ApiResponse({
    status: 200,
    description: 'Audit log detail record retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Audit log record not found',
  })
  async getAuditLogById(
    @Param('id') id: string,
    @Query('source') source?: string
  ) {
    const data = await this.auditService.findById(id, source);
    return {
      success: true,
      data,
      message: 'Audit log details retrieved successfully',
    };
  }
}
