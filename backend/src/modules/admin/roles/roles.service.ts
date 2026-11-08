import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
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

      await tx.auditLog.create({
        data: {
          action: 'ROLE_PERMISSIONS_ASSIGNED',
          entityType: 'Role',
          entityId: role.id,
          description: `Assigned ${permissions.length} permissions to role '${role.slug}'.`,
          userId: actorId,
        },
      });

      return updated;
    });
  }
}

