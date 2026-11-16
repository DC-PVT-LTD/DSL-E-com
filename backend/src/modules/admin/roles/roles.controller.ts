import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  Res,
  Req,
  UseGuards,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';
import { CurrentUser, AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { RolesService } from './roles.service';
import { ConfirmationService } from '../../security/confirmation.service';
import { createZodPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  createRoleSchema,
  CreateRoleDto,
  updateRoleSchema,
  UpdateRoleDto,
  assignRolePermissionsSchema,
  AssignRolePermissionsDto,
} from './dto/roles.dto';

@ApiTags('Admin Roles & Permissions')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('bearerAuth')
@ApiCookieAuth('dsl_access_token')
export class RolesController {
  constructor(
    @Inject(RolesService) private readonly rolesService: RolesService,
    @Inject(ConfirmationService) private readonly confirmationService: ConfirmationService,
  ) {}

  @Get('export')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Export roles and role-permission mappings to CSV or Excel' })
  async export(
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Res() res: Response
  ) {
    return this.rolesService.exportRoles(format, res);
  }

  @Get()
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'List all roles and permission counts' })
  @ApiResponse({ status: 200, description: 'List of roles' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'List all authoritative system permissions' })
  @ApiResponse({ status: 200, description: 'List of permissions' })
  async getPermissions() {
    return this.rolesService.getPermissions();
  }

  @Get(':id')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Get role details with assigned permissions and users' })
  @ApiResponse({ status: 200, description: 'Role details' })
  async findById(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Get(':id/audit-history')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Get role audit history' })
  @ApiResponse({ status: 200, description: 'Role audit logs' })
  async getAuditHistory(@Param('id') id: string) {
    return this.rolesService.getAuditHistory(id);
  }

  @Post()
  @RequireSuperAdmin()
  @ApiOperation({ summary: 'Create a new custom dynamic role (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Role created' })
  async create(
    @Body(createZodPipe(createRoleSchema)) dto: CreateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequireSuperAdmin()
  @ApiOperation({ summary: 'Update a custom role (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async update(
    @Param('id') id: string,
    @Body(createZodPipe(updateRoleSchema)) dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.update(id, dto, actor.id);
  }

  @Delete(':id')
  @RequireSuperAdmin()
  @ApiOperation({ summary: 'Delete an unassigned custom role (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Role deleted' })
  async delete(
    @Param('id') id: string,
    @Req() req: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const role = await this.rolesService.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    await this.confirmationService.validateConfirmation({
      action: 'DELETE_ROLE',
      req,
      targetEntity: 'Role',
      targetId: id,
      expectedValue: role.name,
      actor: {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        role: actor.role,
      },
    });

    return this.rolesService.delete(id, actor.id);
  }

  @Put(':id/permissions')
  @RequireSuperAdmin()
  @ApiOperation({ summary: 'Assign permissions to a role (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Permissions assigned' })
  async assignPermissions(
    @Param('id') id: string,
    @Body(createZodPipe(assignRolePermissionsSchema)) dto: AssignRolePermissionsDto,
    @Req() req: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const role = await this.rolesService.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    await this.confirmationService.validateConfirmation({
      action: 'UPDATE_ROLE_PERMISSIONS',
      req,
      targetEntity: 'Role',
      targetId: id,
      expectedValue: 'UPDATE ROLE PERMISSIONS',
      actor: {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        role: actor.role,
      },
    });

    return this.rolesService.assignPermissions(id, dto, actor.id);
  }
}
