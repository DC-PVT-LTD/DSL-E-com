import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRolePermissionsDto,
} from './dto/roles.dto';
import { verifyAndLockSuperAdminActor } from './super-admin-mutex';

@Injectable()
export class RolesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    return role;
  }

  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async create(dto: CreateRoleDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Sovereign check: Must acquire advisory mutex and verify live Super Admin actor
      await verifyAndLockSuperAdminActor(tx, actorId);

      // Prevent reserve slug collision
      if (dto.slug === 'super_admin') {
        throw new BadRequestException('Cannot create role with reserved slug super_admin.');
      }

      const existingSlug = await tx.role.findUnique({ where: { slug: dto.slug } });
      if (existingSlug) {
        throw new ConflictException(`Role with slug '${dto.slug}' already exists.`);
      }

      const existingName = await tx.role.findUnique({ where: { name: dto.name } });
      if (existingName) {
        throw new ConflictException(`Role with name '${dto.name}' already exists.`);
      }

      // Verify permission keys
      const permissions = await tx.permission.findMany({
        where: { key: { in: dto.permissionKeys } },
      });

      if (permissions.length !== dto.permissionKeys.length) {
        throw new BadRequestException('One or more specified permission keys are invalid.');
      }

      const role = await tx.role.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          isSystem: false,
          isActive: true,
          permissions: {
            create: permissions.map((p) => ({
              permissionId: p.id,
            })),
          },
        },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ROLE_CREATED',
          entityType: 'Role',
          entityId: role.id,
          description: `Custom role '${role.name}' created with ${permissions.length} permissions.`,
          userId: actorId,
        },
      });

      return role;
    });
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await verifyAndLockSuperAdminActor(tx, actorId);

      const role = await tx.role.findUnique({ where: { id } });
      if (!role) {
        throw new NotFoundException('Role not found.');
      }

      // System roles cannot be renamed or deactivated
      if (role.isSystem) {
        if (dto.name && dto.name !== role.name) {
          throw new BadRequestException('System roles cannot be renamed.');
        }
        if (dto.isActive === false) {
          throw new BadRequestException('System roles cannot be deactivated.');
        }
      }

      if (dto.name && dto.name !== role.name) {
        const existingName = await tx.role.findUnique({ where: { name: dto.name } });
        if (existingName) {
          throw new ConflictException(`Role with name '${dto.name}' already exists.`);
        }
      }

      const updated = await tx.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ROLE_UPDATED',
          entityType: 'Role',
          entityId: role.id,
          description: `Role '${role.slug}' updated.`,
          userId: actorId,
        },
      });

      return updated;
    });
  }

  async delete(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await verifyAndLockSuperAdminActor(tx, actorId);

      const role = await tx.role.findUnique({
        where: { id },
        include: { _count: { select: { users: true, invitations: true } } },
      });

      if (!role) {
        throw new NotFoundException('Role not found.');
      }

      if (role.isSystem) {
        throw new BadRequestException('System roles cannot be deleted.');
      }

      if (role._count.users > 0) {
        throw new BadRequestException(
          `Cannot delete role because it is currently assigned to ${role._count.users} user(s).`,
        );
      }

      if (role._count.invitations > 0) {
        throw new BadRequestException(
          `Cannot delete role because it is referenced by ${role._count.invitations} invitation(s).`,
        );
      }

      await tx.role.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          action: 'ROLE_DELETED',
          entityType: 'Role',
          entityId: role.id,
          description: `Custom role '${role.slug}' deleted.`,
          userId: actorId,
        },
      });

      return { message: 'Role deleted successfully.' };
    });
  }

  async assignPermissions(id: string, dto: AssignRolePermissionsDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await verifyAndLockSuperAdminActor(tx, actorId);

      const role = await tx.role.findUnique({ where: { id } });
      if (!role) {
        throw new NotFoundException('Role not found.');
      }

      if (role.slug === 'super_admin') {
        throw new BadRequestException('Permissions of the super_admin role cannot be modified.');
      }

      const permissions = await tx.permission.findMany({
        where: { key: { in: dto.permissionKeys } },
      });

      if (permissions.length !== dto.permissionKeys.length) {
        throw new BadRequestException('One or more specified permission keys are invalid.');
      }

      // Check existing permissions to track added and removed keys for audit logging
      const existingRolePerms = await tx.rolePermission.findMany({
        where: { roleId: id },
        include: { permission: true },
      });
      const oldKeys = new Set(existingRolePerms.map((rp) => rp.permission.key));
      const newKeys = new Set(dto.permissionKeys);
      const addedKeys = dto.permissionKeys.filter((k) => !oldKeys.has(k));
      const removedKeys = Array.from(oldKeys).filter((k) => !newKeys.has(k));

      // Replace permissions: delete existing role permissions and insert new ones
      await tx.rolePermission.deleteMany({ where: { roleId: id } });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: id,
            permissionId: p.id,
          })),
        });
      }

      const updated = await tx.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });

      const auditAction = removedKeys.length > 0 && addedKeys.length === 0 ? 'ROLE_PERMISSIONS_REMOVED' : 'ROLE_PERMISSIONS_ASSIGNED';
      await tx.auditLog.create({
        data: {
          action: auditAction,
          entityType: 'Role',
          entityId: role.id,
          description: `Permissions updated for role '${role.slug}'. Added: [${addedKeys.join(', ') || 'none'}]. Removed: [${removedKeys.join(', ') || 'none'}]. Total: ${permissions.length}.`,
          userId: actorId,
        },
      });

      await tx.adminActivityLog.create({
        data: {
          userId: actorId,
          action: 'UPDATE_ROLE_PERMISSIONS',
          entityType: 'Role',
          entityId: role.id,
          description: `Updated permissions for role '${role.slug}' (Added: ${addedKeys.length}, Removed: ${removedKeys.length})`,
          status: 'SUCCESS',
          beforeState: { permissionKeys: Array.from(oldKeys) },
          afterState: { permissionKeys: dto.permissionKeys },
        },
      });

      return updated;
    });
  }

  /**
   * Retrieve chronological audit history for a role.
   */
  async getAuditHistory(roleId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'Role',
        entityId: roleId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      success: true,
      data: logs,
    };
  }

  /**
   * Export roles and role-permissions to CSV or Excel (.xlsx) with formula injection protection.
   */
  async exportRoles(format: 'csv' | 'xlsx' = 'csv', res: Response) {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    const sanitize = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      if (/^[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
      }
      return str;
    };

    if (format === 'csv') {
      const headers = [
        'Role ID',
        'Role Name',
        'Role Slug',
        'Description',
        'System Role',
        'Active Status',
        'Assigned Administrator Count',
        'Permission Count',
        'Assigned Permission Keys',
      ];

      const rows = roles.map((r) => {
        const permKeys = r.slug === 'super_admin' ? 'ALL_46_PERMISSIONS' : r.permissions.map((p) => p.permission.key).join('; ');
        const permCount = r.slug === 'super_admin' ? 46 : r.permissions.length;
        return [
          sanitize(r.id),
          sanitize(r.name),
          sanitize(r.slug),
          sanitize(r.description || 'N/A'),
          sanitize(r.isSystem ? 'System' : 'Custom'),
          sanitize(r.isActive ? 'Active' : 'Inactive'),
          String(r._count.users),
          String(permCount),
          sanitize(permKeys),
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="roles_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csvContent);
    } else {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const rolesSheet = workbook.addWorksheet('Roles');

      rolesSheet.columns = [
        { header: 'Role ID', key: 'id', width: 28 },
        { header: 'Role Name', key: 'name', width: 22 },
        { header: 'Role Slug', key: 'slug', width: 22 },
        { header: 'Description', key: 'description', width: 36 },
        { header: 'System / Custom', key: 'isSystem', width: 16 },
        { header: 'Active Status', key: 'isActive', width: 14 },
        { header: 'Admin Count', key: 'usersCount', width: 14 },
        { header: 'Permission Count', key: 'permCount', width: 18 },
      ];
      rolesSheet.getRow(1).font = { bold: true };

      for (const r of roles) {
        rolesSheet.addRow({
          id: sanitize(r.id),
          name: sanitize(r.name),
          slug: sanitize(r.slug),
          description: sanitize(r.description || 'N/A'),
          isSystem: sanitize(r.isSystem ? 'System' : 'Custom'),
          isActive: sanitize(r.isActive ? 'Active' : 'Inactive'),
          usersCount: r._count.users,
          permCount: r.slug === 'super_admin' ? 46 : r.permissions.length,
        });
      }

      // Sheet 2: Role Permissions Mapping
      const mappingSheet = workbook.addWorksheet('Role Permissions');
      mappingSheet.columns = [
        { header: 'Role Name', key: 'roleName', width: 22 },
        { header: 'Role Slug', key: 'roleSlug', width: 22 },
        { header: 'Permission Category', key: 'category', width: 20 },
        { header: 'Permission Key', key: 'key', width: 26 },
        { header: 'Display Name', key: 'displayName', width: 26 },
      ];
      mappingSheet.getRow(1).font = { bold: true };

      for (const r of roles) {
        for (const rp of r.permissions) {
          mappingSheet.addRow({
            roleName: sanitize(r.name),
            roleSlug: sanitize(r.slug),
            category: sanitize(rp.permission.category),
            key: sanitize(rp.permission.key),
            displayName: sanitize(rp.permission.displayName),
          });
        }
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="roles_${new Date().toISOString().slice(0, 10)}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }
  }
}
