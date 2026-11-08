import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { UserRole } from '../../generated/prisma';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let mockPrisma: any;
  let mockNotificationsService: any;
  let mockConfigService: any;

  const mockAdminActor = {
    id: 'admin-actor-1',
    email: 'superadmin@dslstationery.lk',
    name: 'Super Admin',
    role: UserRole.ADMIN,
    isActive: true,
  };

  const mockManagerActor = {
    id: 'manager-actor-2',
    email: 'manager@dslstationery.lk',
    name: 'Store Manager',
    role: UserRole.MANAGER,
    isActive: true,
  };

  const mockStaffActor = {
    id: 'staff-actor-3',
    email: 'staff@dslstationery.lk',
    name: 'Staff Member',
    role: UserRole.STAFF,
    isActive: true,
  };

  let targetUserDb: any;

  beforeEach(() => {
    targetUserDb = null;

    mockPrisma = {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === mockAdminActor.id) {
            return Promise.resolve({
              ...mockAdminActor,
              assignedRole: { id: 'role-super', slug: 'super_admin', isSystem: true, isActive: true },
            });
          }
          if (where.id === mockManagerActor.id) {
            return Promise.resolve({
              ...mockManagerActor,
              assignedRole: { id: 'role-pm', slug: 'product_manager', isSystem: true, isActive: true },
            });
          }
          if (where.id === mockStaffActor.id) {
            return Promise.resolve({
              ...mockStaffActor,
              assignedRole: { id: 'role-om', slug: 'order_manager', isSystem: true, isActive: true },
            });
          }
          if (targetUserDb && where.id === targetUserDb.id) {
            return Promise.resolve(targetUserDb);
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      adminInvitation: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      refreshToken: {
        deleteMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({ id: 'role-super', slug: 'super_admin', isSystem: true, isActive: true }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'role-super', slug: 'super_admin', isSystem: true, isActive: true }),
        findFirst: vi.fn().mockResolvedValue({ id: 'role-pm', slug: 'project_manager', isSystem: true, isActive: true }),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    mockNotificationsService = {
      sendAdminInvitationEmail: vi.fn().mockResolvedValue({
        success: true,
        messageId: 'msg-mock-123',
        deliveryStatus: 'DELIVERED',
      }),
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue('http://localhost:3000'),
    };

    service = new AdminUsersService(
      mockPrisma as any,
      mockNotificationsService as any,
      mockConfigService as any
    );
  });

  describe('findAll', () => {
    it('should return paginated administrative accounts', async () => {
      mockPrisma.user.count.mockResolvedValue(2);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: '1', email: 'admin1@dsl.lk', name: 'Admin 1', role: UserRole.ADMIN, isActive: true },
        { id: '2', email: 'staff1@dsl.lk', name: 'Staff 1', role: UserRole.STAFF, isActive: true },
      ]);

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.meta.total).toBe(2);
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });

    it('should filter by role and active status', async () => {
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: '1', email: 'admin1@dsl.lk', name: 'Admin 1', role: UserRole.ADMIN, isActive: true },
      ]);

      const result = await service.findAll({ role: UserRole.ADMIN, isActive: true, page: 1, limit: 20 });
      expect(result.success).toBe(true);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: UserRole.ADMIN,
            isActive: true,
          }),
        })
      );
    });
  });

  describe('createAdmin', () => {
    it('should allow Super Admin to directly create a new administrator account', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-u-1',
        email: 'newstaff@dsl.lk',
        name: 'New Staff',
        role: UserRole.ADMIN,
        roleId: 'role-pm',
        isActive: true,
      });

      const result = await service.createAdmin(
        {
          name: 'New Staff',
          email: 'newstaff@dsl.lk',
          role: UserRole.STAFF,
          password: 'Password123!',
        },
        mockAdminActor
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_USER_CREATED',
            userId: mockAdminActor.id,
          }),
        })
      );
    });

    it('should reject creation if email already exists', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.email === 'existing@dsl.lk') return Promise.resolve({ id: 'existing-id' });
        if (where.id === mockAdminActor.id) {
          return Promise.resolve({
            ...mockAdminActor,
            assignedRole: { id: 'role-super', slug: 'super_admin', isSystem: true, isActive: true },
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.createAdmin(
          {
            name: 'Existing',
            email: 'existing@dsl.lk',
            role: UserRole.STAFF,
            password: 'Password123!',
          },
          mockAdminActor
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should reject non-super-admin actor attempting to create an account', async () => {
      await expect(
        service.createAdmin(
          {
            name: 'Test',
            email: 'test@dsl.lk',
            role: UserRole.STAFF,
            password: 'Password123!',
          },
          mockStaffActor
        )
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.createAdmin(
          {
            name: 'Test',
            email: 'test@dsl.lk',
            role: UserRole.ADMIN,
            password: 'Password123!',
          },
          mockManagerActor
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('inviteAdmin', () => {
    it('should generate an unpredictable cryptographic token hash and dispatch invitation email', async () => {
      mockPrisma.adminInvitation.create.mockResolvedValue({
        id: 'inv-uuid-1',
        email: 'invitee@dsl.lk',
        name: 'Invitee Name',
        role: UserRole.STAFF,
        roleId: 'role-pm',
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      });

      const result = await service.inviteAdmin(
        {
          name: 'Invitee Name',
          email: 'invitee@dsl.lk',
          role: UserRole.STAFF,
        },
        mockAdminActor
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.adminInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'invitee@dsl.lk',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
            invitedById: mockAdminActor.id,
          }),
        })
      );
      expect(mockNotificationsService.sendAdminInvitationEmail).toHaveBeenCalled();
    });

    it('should reject invitation if active admin with that email exists', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.email === 'activeadmin@dsl.lk') {
          return Promise.resolve({
            id: 'existing-admin',
            role: UserRole.ADMIN,
            isActive: true,
          });
        }
        if (where.id === mockAdminActor.id) {
          return Promise.resolve({
            ...mockAdminActor,
            assignedRole: { id: 'role-super', slug: 'super_admin', isSystem: true, isActive: true },
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.inviteAdmin(
          {
            email: 'activeadmin@dsl.lk',
            name: 'Active Admin',
            role: UserRole.STAFF,
          },
          mockAdminActor
        )
      ).rejects.toThrow(ConflictException);
    });

    it('should reject non-super-admin attempting to invite a Super Admin', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'role-super',
        slug: 'super_admin',
        isSystem: true,
        isActive: true,
      });

      await expect(
        service.inviteAdmin(
          {
            email: 'newadmin@dsl.lk',
            name: 'Invitee',
            role: UserRole.ADMIN,
            roleId: 'role-super',
          },
          mockManagerActor
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus (activation / deactivation)', () => {
    it('should prevent self-deactivation', async () => {
      await expect(
        service.updateStatus(mockAdminActor.id, { isActive: false }, mockAdminActor)
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent deactivating the last active Super Admin', async () => {
      targetUserDb = {
        id: 'other-admin-id',
        email: 'otheradmin@dsl.lk',
        role: UserRole.ADMIN,
        roleId: 'role-super',
        assignedRole: { id: 'role-super', slug: 'super_admin', isActive: true },
        isActive: true,
      };
      // Only 1 active Super Admin remaining
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        service.updateStatus('other-admin-id', { isActive: false }, mockAdminActor)
      ).rejects.toThrow('Cannot deactivate the last active Super Admin account');
    });

    it('should revoke all refresh tokens when an account is deactivated', async () => {
      targetUserDb = {
        id: 'staff-id',
        email: 'staff@dsl.lk',
        role: UserRole.STAFF,
        roleId: 'role-om',
        assignedRole: { id: 'role-om', slug: 'order_manager', isActive: true },
        isActive: true,
      };
      mockPrisma.user.update.mockResolvedValue({
        id: 'staff-id',
        email: 'staff@dsl.lk',
        name: 'Staff Member',
        role: UserRole.ADMIN,
        roleId: 'role-om',
        isActive: false,
      });

      const result = await service.updateStatus('staff-id', { isActive: false }, mockAdminActor);
      expect(result.success).toBe(true);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'staff-id' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_USER_DEACTIVATED',
            entityId: 'staff-id',
          }),
        })
      );
    });

    it('should activate an inactive account without revoking sessions', async () => {
      targetUserDb = {
        id: 'staff-id',
        email: 'staff@dsl.lk',
        role: UserRole.STAFF,
        roleId: 'role-om',
        assignedRole: { id: 'role-om', slug: 'order_manager', isActive: true },
        isActive: false,
      };
      mockPrisma.user.update.mockResolvedValue({
        id: 'staff-id',
        email: 'staff@dsl.lk',
        name: 'Staff Member',
        role: UserRole.ADMIN,
        roleId: 'role-om',
        isActive: true,
      });

      const result = await service.updateStatus('staff-id', { isActive: true }, mockAdminActor);
      expect(result.success).toBe(true);
      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('should prevent modifying own role', async () => {
      await expect(
        service.updateRole(mockAdminActor.id, { role: UserRole.MANAGER }, mockAdminActor)
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent demoting the last active Super Admin', async () => {
      targetUserDb = {
        id: 'target-admin-id',
        email: 'admin2@dsl.lk',
        role: UserRole.ADMIN,
        roleId: 'role-super',
        assignedRole: { id: 'role-super', slug: 'super_admin', isActive: true },
        isActive: true,
      };
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.role.findUnique.mockResolvedValue({
        id: 'role-om',
        slug: 'order_manager',
        isActive: true,
      });

      await expect(
        service.updateRole('target-admin-id', { role: UserRole.STAFF, roleId: 'role-om' }, mockAdminActor)
      ).rejects.toThrow('Cannot demote the last active Super Admin account');
    });

    it('should prevent non-super-admin from changing roles', async () => {
      targetUserDb = {
        id: 'target-id',
        email: 'staff@dsl.lk',
        role: UserRole.STAFF,
        isActive: true,
      };

      await expect(
        service.updateRole('target-id', { role: UserRole.ADMIN }, mockManagerActor)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke an unused invitation and log audit record', async () => {
      mockPrisma.adminInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        email: 'pending@dsl.lk',
        usedAt: null,
      });

      const result = await service.revokeInvitation('inv-1', mockAdminActor);
      expect(result.success).toBe(true);
      expect(mockPrisma.adminInvitation.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_INVITATION_REVOKED',
            entityId: 'inv-1',
          }),
        })
      );
    });

    it('should throw BadRequestException if invitation was already used', async () => {
      mockPrisma.adminInvitation.findUnique.mockResolvedValue({
        id: 'inv-used',
        email: 'used@dsl.lk',
        usedAt: new Date(),
      });

      await expect(service.revokeInvitation('inv-used', mockAdminActor)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
