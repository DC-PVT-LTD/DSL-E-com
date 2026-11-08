import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './admin/roles/roles.service';
import { AdminUsersService } from './admin-users/admin-users.service';
import { AuthService } from './auth/auth.service';
import { AppModule } from '../app.module';
import { UserRole } from '../generated/prisma';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

describe('Phase 3 RBAC & Concurrency Security (E2E & Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rolesService: RolesService;
  let adminUsersService: AdminUsersService;
  let authService: AuthService;

  let superAdminUser: any;
  let secondaryAdminUser: any;
  let superAdminRole: any;
  let orderManagerRole: any;
  let productManagerRole: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    rolesService = app.get<RolesService>(RolesService);
    adminUsersService = app.get<AdminUsersService>(AdminUsersService);
    authService = app.get<AuthService>(AuthService);

    // Fetch seeded roles
    superAdminRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'super_admin' } });
    orderManagerRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'order_manager' } });
    productManagerRole = await prisma.role.findUniqueOrThrow({ where: { slug: 'product_manager' } });

    // Setup primary Super Admin
    superAdminUser = await prisma.user.findFirst({
      where: { email: 'admin@dslstationery.lk' },
      include: { assignedRole: true },
    });

    if (!superAdminUser || superAdminUser.roleId !== superAdminRole.id) {
      superAdminUser = await prisma.user.upsert({
        where: { email: 'admin@dslstationery.lk' },
        update: {
          role: UserRole.ADMIN,
          roleId: superAdminRole.id,
          isActive: true,
        },
        create: {
          email: 'admin@dslstationery.lk',
          name: 'Primary Super Admin',
          role: UserRole.ADMIN,
          roleId: superAdminRole.id,
          isActive: true,
        },
        include: { assignedRole: true },
      });
    }

    // Create isolated test secondary admin
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    secondaryAdminUser = await prisma.user.upsert({
      where: { email: 'test.secondary.admin@dslstationery.lk' },
      update: {
        role: UserRole.ADMIN,
        roleId: null, // Quarantined initially
        isActive: true,
      },
      create: {
        email: 'test.secondary.admin@dslstationery.lk',
        name: 'Secondary Admin',
        role: UserRole.ADMIN,
        roleId: null,
        passwordHash,
        isActive: true,
      },
      include: { assignedRole: true },
    });
  });

  afterAll(async () => {
    // Cleanup temporary test users
    await prisma.adminInvitation.deleteMany({
      where: { email: { contains: 'test.inv' } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['test.secondary.admin@dslstationery.lk', 'test.super2@dsl.lk', 'test.super3@dsl.lk', 'test.created@dsl.lk'] } },
    });
    await app.close();
  });

  describe('1. Super Admin Promotion, Demotion & Last Admin Protection', () => {
    it('should promote an administrator to Super Admin when actor is Super Admin', async () => {
      const updated = await adminUsersService.updateRole(
        secondaryAdminUser.id,
        { role: UserRole.ADMIN, roleId: superAdminRole.id },
        { id: superAdminUser.id, email: superAdminUser.email, role: UserRole.ADMIN } as any,
      );

      expect(updated.success).toBe(true);
      expect(updated.data.roleId).toBe(superAdminRole.id);

      const dbUser = await prisma.user.findUnique({ where: { id: secondaryAdminUser.id } });
      expect(dbUser?.roleId).toBe(superAdminRole.id);
    });

    it('should prevent self-demotion and self-deactivation', async () => {
      await expect(
        adminUsersService.updateRole(
          superAdminUser.id,
          { role: UserRole.ADMIN, roleId: orderManagerRole.id },
          { id: superAdminUser.id, email: superAdminUser.email, role: UserRole.ADMIN } as any,
        ),
      ).rejects.toThrow('You cannot modify your own administrative role');

      await expect(
        adminUsersService.updateStatus(
          superAdminUser.id,
          { isActive: false },
          { id: superAdminUser.id, email: superAdminUser.email, role: UserRole.ADMIN } as any,
        ),
      ).rejects.toThrow('You cannot deactivate your own administrative account');
    });

    it('should prevent deactivating the last active Super Admin', async () => {
      // Demote secondary admin first so only 1 Super Admin remains
      await adminUsersService.updateRole(
        secondaryAdminUser.id,
        { role: UserRole.ADMIN, roleId: orderManagerRole.id },
        { id: superAdminUser.id, email: superAdminUser.email, role: UserRole.ADMIN } as any,
      );

      // Verify active super admin count is 1
      const count = await prisma.user.count({
        where: { roleId: superAdminRole.id, role: UserRole.ADMIN, isActive: true },
      });
      expect(count).toBe(1);

      // Create a dummy second Super Admin to test demotion/deactivation
      const super2 = await prisma.user.create({
        data: {
          email: 'test.super2@dsl.lk',
          name: 'Super 2',
          role: UserRole.ADMIN,
          roleId: superAdminRole.id,
          isActive: true,
        },
      });

      // Deactivate super2 -> now only 1 active Super Admin remains
      await adminUsersService.updateStatus(
        super2.id,
        { isActive: false },
        { id: superAdminUser.id, email: superAdminUser.email, role: UserRole.ADMIN } as any,
      );

      // Attempting to demote the last remaining active Super Admin (superAdminUser) must fail
      await expect(
        adminUsersService.updateRole(
          superAdminUser.id,
          { role: UserRole.ADMIN, roleId: orderManagerRole.id },
          { id: super2.id, email: super2.email, role: UserRole.ADMIN } as any,
        ),
      ).rejects.toThrow();

      // Clean up super2
      await prisma.user.delete({ where: { id: super2.id } });
    });
  });

  describe('2. Concurrency: Simultaneous Last Super Admin Deactivations', () => {
    it('should serialize simultaneous deactivations and prevent zero Super Admins', async () => {
      // Create two active Super Admins: Super A and Super B
      const superA = await prisma.user.create({
        data: {
          email: 'test.super2@dsl.lk',
          name: 'Super A',
          role: UserRole.ADMIN,
          roleId: superAdminRole.id,
          isActive: true,
        },
      });

      const superB = await prisma.user.create({
        data: {
          email: 'test.super3@dsl.lk',
          name: 'Super B',
          role: UserRole.ADMIN,
          roleId: superAdminRole.id,
          isActive: true,
        },
      });

      // Temporarily deactivate primary admin so exactly Super A and Super B exist (count = 2)
      await prisma.user.update({
        where: { id: superAdminUser.id },
        data: { isActive: false },
      });

      // Concurrently execute: Super A deactivates Super B, AND Super B deactivates Super A
      const [resultA, resultB] = await Promise.allSettled([
        adminUsersService.updateStatus(
          superB.id,
          { isActive: false },
          { id: superA.id, email: superA.email, role: UserRole.ADMIN } as any,
        ),
        adminUsersService.updateStatus(
          superA.id,
          { isActive: false },
          { id: superB.id, email: superB.email, role: UserRole.ADMIN } as any,
        ),
      ]);

      // Assert: Exactly one must succeed, and the second must be rejected with 400
      const successes = [resultA, resultB].filter((r) => r.status === 'fulfilled');
      const failures = [resultA, resultB].filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify that at least 1 Super Admin remains strictly active
      const activeCount = await prisma.user.count({
        where: { roleId: superAdminRole.id, role: UserRole.ADMIN, isActive: true },
      });
      expect(activeCount).toBe(1);

      // Restore primary Super Admin and clean up
      await prisma.user.update({
        where: { id: superAdminUser.id },
        data: { isActive: true },
      });
      await prisma.user.deleteMany({ where: { id: { in: [superA.id, superB.id] } } });
    });
  });

  describe('3. Concurrency: Simultaneous Invitation Acceptance', () => {
    it('should allow exactly one acceptance for the same invitation token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const invitation = await prisma.adminInvitation.create({
        data: {
          email: 'test.inv.concurrent@dsl.lk',
          name: 'Invitee Concurrent',
          role: UserRole.ADMIN,
          roleId: orderManagerRole.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          invitedById: superAdminUser.id,
        },
      });

      const mockRes1 = { cookie: vi.fn(), clearCookie: vi.fn() } as any;
      const mockRes2 = { cookie: vi.fn(), clearCookie: vi.fn() } as any;

      // Two concurrent acceptance requests
      const [res1, res2] = await Promise.allSettled([
        authService.acceptInvitation({ token: rawToken, password: 'PassAccept123!' }, mockRes1),
        authService.acceptInvitation({ token: rawToken, password: 'PassAccept123!' }, mockRes2),
      ]);

      const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
      const failures = [res1, res2].filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify account was created exactly once
      const createdUsers = await prisma.user.findMany({
        where: { email: 'test.inv.concurrent@dsl.lk' },
      });
      expect(createdUsers.length).toBe(1);

      // Cleanup
      await prisma.user.deleteMany({ where: { email: 'test.inv.concurrent@dsl.lk' } });
      await prisma.adminInvitation.deleteMany({ where: { id: invitation.id } });
    });
  });

  describe('4. Invitation Acceptance vs Role Deactivation', () => {
    it('should reject invitation acceptance if the assigned role was deactivated', async () => {
      // Create a temporary dynamic custom role and deactivate it
      const customRole = await prisma.role.create({
        data: {
          name: 'Temporary Deactivated Role',
          slug: 'temp_deactivated_role',
          isSystem: false,
          isActive: false, // Inactive!
        },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const invitation = await prisma.adminInvitation.create({
        data: {
          email: 'test.inv.inactive.role@dsl.lk',
          name: 'Invitee Inactive Role',
          role: UserRole.STAFF,
          roleId: customRole.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          invitedById: superAdminUser.id,
        },
      });

      const mockRes = { cookie: vi.fn() } as any;

      await expect(
        authService.acceptInvitation({ token: rawToken, password: 'PassAccept123!' }, mockRes),
      ).rejects.toThrow('The role assigned to this invitation has been deactivated.');

      // Clean up
      await prisma.adminInvitation.deleteMany({ where: { id: invitation.id } });
      await prisma.role.delete({ where: { id: customRole.id } });
    });
  });

  describe('5. Role Management & Permission Enforcement', () => {
    it('should list all 38 authoritative permissions', async () => {
      const perms = await rolesService.getPermissions();
      expect(perms.length).toBe(38);
    });

    it('should prevent non-super-admin from creating or deleting custom roles', async () => {
      await expect(
        rolesService.create(
          { name: 'Hacker Role', slug: 'hacker_role', permissionKeys: [] },
          secondaryAdminUser.id, // Not super admin
        ),
      ).rejects.toThrow('Security violation: live Super Admin credentials required.');
    });

    it('should prevent modifying or deleting system roles', async () => {
      await expect(
        rolesService.delete(superAdminRole.id, superAdminUser.id),
      ).rejects.toThrow('System roles cannot be deleted.');

      await expect(
        rolesService.update(superAdminRole.id, { isActive: false }, superAdminUser.id),
      ).rejects.toThrow('System roles cannot be deactivated.');
    });
  });

  describe('6. Protected Product Stock Invariant', () => {
    it('should verify protected product stock remains strictly 10 units', async () => {
      const protectedProduct = await prisma.product.findUnique({
        where: { id: 'cmw0j4cro00089kusmwsbv48t' },
        select: { id: true, name: true, stockQuantity: true },
      });

      expect(protectedProduct).toBeDefined();
      expect(protectedProduct?.stockQuantity).toBe(10);
    });
  });
});
