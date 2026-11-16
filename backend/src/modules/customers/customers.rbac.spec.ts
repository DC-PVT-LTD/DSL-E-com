import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../generated/prisma';
import { CustomersController } from './customers.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('CustomersController — RBAC & Authorization Tests', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;
  let jwtAuthGuard: JwtAuthGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
    jwtAuthGuard = new JwtAuthGuard(reflector);
  });

  function createMockContext(handler: Function, user?: any): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => CustomersController,
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers: user ? { authorization: 'Bearer valid.jwt.token' } : {},
        }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Customer Data Export (exportCustomers)', () => {
    it('restricts customer export to ADMIN and MANAGER and excludes STAFF', () => {
      const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        CustomersController.prototype.exportCustomers,
        CustomersController,
      ]);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.MANAGER]);
      expect(roles).not.toContain(UserRole.STAFF);
    });

    it('permits ADMIN user to export customers', () => {
      const ctx = createMockContext(CustomersController.prototype.exportCustomers, {
        id: 'admin-1',
        role: UserRole.ADMIN,
      });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('permits MANAGER user to export customers', () => {
      const ctx = createMockContext(CustomersController.prototype.exportCustomers, {
        id: 'mgr-1',
        role: UserRole.MANAGER,
      });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('rejects STAFF user from exporting customers with ForbiddenException', () => {
      const ctx = createMockContext(CustomersController.prototype.exportCustomers, {
        id: 'staff-1',
        role: UserRole.STAFF,
      });
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('Customer Account Status Update (updateStatus)', () => {
    it('restricts customer status toggle to ADMIN and MANAGER and excludes STAFF', () => {
      const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        CustomersController.prototype.updateStatus,
        CustomersController,
      ]);
      expect(roles).toEqual([UserRole.ADMIN, UserRole.MANAGER]);
      expect(roles).not.toContain(UserRole.STAFF);
    });

    it('permits ADMIN user to update status', () => {
      const ctx = createMockContext(CustomersController.prototype.updateStatus, {
        id: 'admin-1',
        role: UserRole.ADMIN,
      });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('permits MANAGER user to update status', () => {
      const ctx = createMockContext(CustomersController.prototype.updateStatus, {
        id: 'mgr-1',
        role: UserRole.MANAGER,
      });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('rejects STAFF user from updating customer status with ForbiddenException', () => {
      const ctx = createMockContext(CustomersController.prototype.updateStatus, {
        id: 'staff-1',
        role: UserRole.STAFF,
      });
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('Read-only endpoints (findAll, findById, getAnalytics)', () => {
    it('permits STAFF user to list customers, view details, and view analytics', () => {
      const staffUser = { id: 'staff-1', role: UserRole.STAFF };

      const ctxList = createMockContext(CustomersController.prototype.findAll, staffUser);
      expect(rolesGuard.canActivate(ctxList)).toBe(true);

      const ctxDetail = createMockContext(CustomersController.prototype.findById, staffUser);
      expect(rolesGuard.canActivate(ctxDetail)).toBe(true);

      const ctxAnalytics = createMockContext(CustomersController.prototype.getAnalytics, staffUser);
      expect(rolesGuard.canActivate(ctxAnalytics)).toBe(true);
    });

    it('rejects CUSTOMER role from accessing customer management endpoints with ForbiddenException', () => {
      const customerUser = { id: 'cust-1', role: UserRole.CUSTOMER };

      const ctxList = createMockContext(CustomersController.prototype.findAll, customerUser);
      expect(() => rolesGuard.canActivate(ctxList)).toThrow(ForbiddenException);

      const ctxExport = createMockContext(CustomersController.prototype.exportCustomers, customerUser);
      expect(() => rolesGuard.canActivate(ctxExport)).toThrow(ForbiddenException);

      const ctxStatus = createMockContext(CustomersController.prototype.updateStatus, customerUser);
      expect(() => rolesGuard.canActivate(ctxStatus)).toThrow(ForbiddenException);
    });
  });
});

