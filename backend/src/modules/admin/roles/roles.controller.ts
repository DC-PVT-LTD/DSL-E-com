import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';
import { CurrentUser, AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import { RolesService } from './roles.service';
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
  constructor(@Inject(RolesService) private readonly rolesService: RolesService) {}

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
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.delete(id, actor.id);
  }

  @Put(':id/permissions')
  @RequireSuperAdmin()
  @ApiOperation({ summary: 'Assign permissions to a role (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Permissions assigned' })
  async assignPermissions(
    @Param('id') id: string,
    @Body(createZodPipe(assignRolePermissionsSchema)) dto: AssignRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.assignPermissions(id, dto, actor.id);
  }
}

