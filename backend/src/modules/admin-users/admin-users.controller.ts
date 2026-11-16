import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import { ConfirmationService } from '../security/confirmation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { RequireSuperAdmin } from '../admin/roles/decorators/require-super-admin.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createAdminUserSchema,
  CreateAdminUserDto,
  inviteAdminUserSchema,
  InviteAdminUserDto,
  adminUserQuerySchema,
  AdminUserQueryDto,
  updateAdminStatusSchema,
  UpdateAdminStatusDto,
  updateAdminRoleSchema,
  UpdateAdminRoleDto,
  updateAdminProfileSchema,
  UpdateAdminProfileDto,
  adminExportQuerySchema,
  AdminExportQueryDto,
} from './dto/admin-users.dto';

@ApiTags('Admin User Management')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('dsl_access_token')
@ApiBearerAuth('bearerAuth')
export class AdminUsersController {
  constructor(
    @Inject(AdminUsersService) private readonly adminUsersService: AdminUsersService,
    @Inject(ConfirmationService) private readonly confirmationService: ConfirmationService,
  ) {}

  @Get('stats')
  @RequirePermissions('admins.view')
  @ApiOperation({
    summary: 'Get administrator overview card metrics',
    description: 'Returns real database counts for total, active, inactive admins, invitations, and roles.',
  })
  @ApiResponse({ status: 200, description: 'Overview statistics' })
  async getStats() {
    return this.adminUsersService.getStats();
  }

  @Get('export')
  @RequirePermissions('admins.view')
  @ApiOperation({
    summary: 'Export administrator accounts',
    description: 'Streams filtered administrator accounts to CSV or Excel (.xlsx) with formula injection protection.',
  })
  async export(
    @Query(createZodPipe(adminExportQuerySchema)) query: AdminExportQueryDto,
    @Res() res: Response
  ) {
    return this.adminUsersService.exportAdminUsers(query, res);
  }

  @Get()
  @RequirePermissions('admins.view')
  @ApiOperation({
    summary: 'List administrator accounts',
    description: 'Retrieves all administrative users with search, role, and active status filters.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of administrative users' })
  async findAll(@Query(createZodPipe(adminUserQuerySchema)) query: AdminUserQueryDto) {
    return this.adminUsersService.findAll(query);
  }

  @Get('invitations')
  @RequirePermissions('admins.invite')
  @ApiOperation({
    summary: 'List pending administrator invitations',
    description: 'Retrieves all pending invitations that have not yet been used.',
  })
  @ApiResponse({ status: 200, description: 'List of pending invitations' })
  async findInvitations() {
    return this.adminUsersService.findInvitations();
  }

  @Get(':id')
  @RequirePermissions('admins.view')
  @ApiOperation({
    summary: 'Get administrator by ID',
    description: 'Returns profile details for a specific administrative user.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Administrator profile' })
  @ApiResponse({ status: 404, description: 'Administrator account not found' })
  async findById(@Param('id') id: string) {
    return this.adminUsersService.findById(id);
  }

  @Get(':id/audit-history')
  @RequirePermissions('admins.view')
  @ApiOperation({
    summary: 'Get administrator activity and audit history',
    description: 'Returns real chronological audit history logs for this administrator.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'List of audit events' })
  async getAuditHistory(@Param('id') id: string) {
    return this.adminUsersService.getAuditHistory(id);
  }

  @Post()
  @RequireSuperAdmin()
  @ApiOperation({
    summary: 'Directly create administrator account (Super Admin only)',
    description: 'Creates a new administrator account with a pre-configured password and marks it active.',
  })
  @ApiResponse({ status: 201, description: 'Administrator account created' })
  @ApiResponse({ status: 403, description: 'Insufficient privileges to create specified role' })
  @ApiResponse({ status: 409, description: 'A user with this email address already exists' })
  async createAdmin(
    @Body(createZodPipe(createAdminUserSchema)) dto: CreateAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.adminUsersService.createAdmin(dto, actor);
  }

  @Post('invite')
  @RequirePermissions('admins.invite')
  @ApiOperation({
    summary: 'Invite new administrator',
    description: 'Generates a single-use cryptographically secure invitation token, stores its hash, and dispatches an invitation link.',
  })
  @ApiResponse({ status: 201, description: 'Invitation created and dispatched' })
  @ApiResponse({ status: 403, description: 'Insufficient privileges to invite specified role' })
  @ApiResponse({ status: 409, description: 'An administrator account with this email address already exists' })
  async inviteAdmin(
    @Body(createZodPipe(inviteAdminUserSchema)) dto: InviteAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.adminUsersService.inviteAdmin(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('admins.manage')
  @ApiOperation({
    summary: 'Update administrator profile details',
    description: 'Updates full name and phone number for an administrator.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 404, description: 'Administrator account not found' })
  async updateProfile(
    @Param('id') id: string,
    @Body(createZodPipe(updateAdminProfileSchema)) dto: UpdateAdminProfileDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.adminUsersService.updateProfile(id, dto, actor);
  }

  @Patch(':id/status')
  @RequirePermissions('admins.manage')
  @ApiOperation({
    summary: 'Activate or deactivate administrator',
    description: 'Updates active status. Deactivating revokes all active refresh tokens immediately and blocks further API requests.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Self-deactivation or deactivating last admin is prohibited' })
  @ApiResponse({ status: 403, description: 'Insufficient privileges to deactivate this user' })
  async updateStatus(
    @Param('id') id: string,
    @Body(createZodPipe(updateAdminStatusSchema)) dto: UpdateAdminStatusDto,
    @Req() req: any,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    if (dto.isActive === false) {
      const targetUserRes = await this.adminUsersService.findById(id);
      const targetUser = (targetUserRes as any)?.data || targetUserRes;
      if (!targetUser) {
        throw new NotFoundException('Administrator account not found');
      }

      await this.confirmationService.validateConfirmation({
        action: 'DEACTIVATE_ADMIN',
        req,
        targetEntity: 'User',
        targetId: id,
        expectedValue: targetUser.email,
        actor: {
          id: actor.id,
          email: actor.email,
          name: actor.name,
          role: actor.role,
        },
        isEmail: true,
      });
    }

    return this.adminUsersService.updateStatus(id, dto, actor);
  }

  @Patch(':id/role')
  @RequireSuperAdmin()
  @ApiOperation({
    summary: 'Change administrator role (Super Admin only)',
    description: 'Updates administrative dynamic role or removes role assignment. Cannot change own role, and cannot demote the last admin.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 400, description: 'Self-role modification or demoting last admin is prohibited' })
  @ApiResponse({ status: 403, description: 'Insufficient privileges to assign this role' })
  async updateRole(
    @Param('id') id: string,
    @Body(createZodPipe(updateAdminRoleSchema)) dto: UpdateAdminRoleDto,
    @Req() req: any,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const targetUserRes = await this.adminUsersService.findById(id);
    const targetUser = (targetUserRes as any)?.data || targetUserRes;
    if (!targetUser) {
      throw new NotFoundException('Administrator account not found');
    }

    await this.confirmationService.validateConfirmation({
      action: 'CHANGE_ADMIN_ROLE',
      req,
      targetEntity: 'User',
      targetId: id,
      expectedValue: 'CHANGE ADMIN ROLE',
      actor: {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        role: actor.role,
      },
    });

    return this.adminUsersService.updateRole(id, dto, actor);
  }

  @Post(':id/reset-password')
  @RequirePermissions('admins.manage')
  @ApiOperation({
    summary: 'Trigger administrator password reset',
    description: 'Generates a secure password reset token and dispatches an email instructions link.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Password reset link dispatched' })
  async triggerPasswordReset(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.adminUsersService.triggerPasswordReset(id, actor);
  }

  @Delete('invitations/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('admins.invite')
  @ApiOperation({
    summary: 'Revoke pending administrator invitation',
    description: 'Deletes a pending invitation so its token can no longer be accepted.',
  })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation revoked successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async revokeInvitation(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.adminUsersService.revokeInvitation(id, actor);
  }
}
