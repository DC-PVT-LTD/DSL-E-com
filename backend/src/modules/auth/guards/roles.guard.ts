import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../../admin/roles/decorators/require-permissions.decorator';
import { REQUIRE_SUPER_ADMIN_KEY } from '../../admin/roles/decorators/require-super-admin.decorator';
import { UserRole } from '../../../generated/prisma';

@Injectable()
export class RolesGuard implements CanActivate {
  private reflector: Reflector;

  constructor(@Optional() @Inject(Reflector) reflector?: Reflector) {
    this.reflector = reflector || new Reflector();
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiresSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_SUPER_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if ((!requiredRoles || requiredRoles.length === 0) && !requiredPermissions && !requiresSuperAdmin) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: user role not verified');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Access denied: account is deactivated');
    }

    // 1. Static enum check
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role as UserRole);
      if (!hasRole) {
        throw new ForbiddenException(`Access denied: required role ${requiredRoles.join(' or ')}`);
      }
    }

    // 2. Dynamic Super Admin check
    if (requiresSuperAdmin) {
      if (user.assignedRole?.slug !== 'super_admin') {
        throw new ForbiddenException('Access denied: requires Super Admin privileges.');
      }
      return true;
    }

    // 3. Dynamic granular permissions check
    if (requiredPermissions && requiredPermissions.length > 0) {
      // Super Admin role automatically bypasses granular permissions
      if (user.assignedRole?.slug === 'super_admin') {
        return true;
      }

      // Quarantined administrators (roleId = null or assignedRole is inactive) cannot access permission-guarded routes
      if (!user.roleId || !user.assignedRole || !user.assignedRole.isActive) {
        throw new ForbiddenException(
          'Your administrator account is pending dynamic role assignment. Please contact the primary Super Admin.',
        );
      }

      const grantedPermissions = new Set(
        (user.assignedRole.permissions || []).map((rp: any) => rp.permission?.key || rp.permissionId || rp)
      );

      const hasAllRequired = requiredPermissions.every((perm) => grantedPermissions.has(perm));
      if (!hasAllRequired) {
        throw new ForbiddenException(
          `Access denied: missing required permissions (${requiredPermissions.join(', ')}).`,
        );
      }
    }

    return true;
  }
}

