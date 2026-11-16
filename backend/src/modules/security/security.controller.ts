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
import { SecurityService } from './security.service';
import { createApiResponse } from '../../common/interfaces/api-response.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireSuperAdmin } from '../admin/roles/decorators/require-super-admin.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Admin Security & Verification')
@Controller('admin/security')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('bearerAuth')
@ApiCookieAuth('dsl_access_token')
export class SecurityController {
  constructor(
    @Inject(SecurityService)
    private readonly securityService: SecurityService,
  ) {}

  @Get('challenges')
  @RequireSuperAdmin()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List security verification challenge audit trail (Super Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Security challenge audit records retrieved successfully',
  })
  async listChallenges(@Query() query: any) {
    const result = await this.securityService.listChallenges(query);
    return createApiResponse(result, 'Security challenges retrieved successfully');
  }
}

