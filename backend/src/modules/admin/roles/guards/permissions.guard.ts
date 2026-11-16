import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { REQUIRE_SUPER_ADMIN_KEY } from '../decorators/require-super-admin.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiresSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUPER_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Customer or unauthenticated accounts denied immediately
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER' && user.role !== 'STAFF')) {
      throw new ForbiddenException('Access denied: administrative role required.');
    }

    // Verify live role and permissions from PostgreSQL database if not already populated
    let dbUser = user.assignedRole !== undefined
      ? user
      : await this.prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            role: true,
            roleId: true,
            isActive: true,
            assignedRole: {
              select: {
                id: true,
                slug: true,
                isActive: true,
                permissions: {
                  select: {
                    permission: {
                      select: { key: true },
                    },
                  },
                },
              },
            },
          },
        });

    if (!dbUser || !dbUser.isActive || (dbUser.role !== 'ADMIN' && dbUser.role !== 'MANAGER' && dbUser.role !== 'STAFF')) {
      throw new ForbiddenException('Access denied: inactive or invalid administrative account.');
    }

    // Quarantined administrators (roleId = null) are blocked from protected administrative endpoints
    if (!dbUser.roleId || !dbUser.assignedRole || !dbUser.assignedRole.isActive) {
      throw new ForbiddenException(
        'Your administrator account is pending dynamic role assignment. Please contact the primary Super Admin.',
      );
    }

    const roleSlug = dbUser.assignedRole.slug;
    request.user = dbUser;

    // If neither permissions nor Super Admin are explicitly annotated, active administrative role allows baseline access
    if (!requiredPermissions && !requiresSuperAdmin) {
      return true;
    }

    // Super Admin check: If route requires Super Admin specifically
    if (requiresSuperAdmin) {
      if (roleSlug !== 'super_admin') {
        throw new ForbiddenException('Access denied: requires Super Admin privileges.');
      }
      return true;
    }

    // Super Admin role automatically bypasses granular permission checks
    if (roleSlug === 'super_admin') {
      return true;
    }

    // Check granular permissions for custom / non-super-admin roles
    if (requiredPermissions && requiredPermissions.length > 0) {
      const grantedPermissions = new Set(
        dbUser.assignedRole.permissions.map((rp: any) => rp.permission?.key || rp.permissionId),
      );

      const hasAllRequired = requiredPermissions.every((perm) =>
        grantedPermissions.has(perm),
      );

      if (!hasAllRequired) {
        throw new ForbiddenException(
          `Access denied: missing required permissions (${requiredPermissions.join(', ')}).`,
        );
      }
    }

    return true;
  }
}

export function hasUserPermission(user: any, permissionKey: string): boolean {
  if (!user) return false;
  const roleSlug = user.assignedRole?.slug || user.roleSlug;
  if (roleSlug === 'super_admin') return true;
  const perms: string[] =
    user.assignedRole?.permissions?.map((p: any) => p.permission?.key || p.key || p) ||
    user.permissions ||
    [];
  return perms.includes(permissionKey);
}


