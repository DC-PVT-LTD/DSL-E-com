import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLogQueryDto, auditLogQuerySchema } from './dto/audit-query.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Admin API', 'Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('bearerAuth')
@ApiCookieAuth('dsl_access_token')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List paginated audit logs (Admin only)',
    description:
      'Protected administrative endpoint to retrieve catalogue and system audit logs with filtering by entityType, entityId, action, or actor.',
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
}

