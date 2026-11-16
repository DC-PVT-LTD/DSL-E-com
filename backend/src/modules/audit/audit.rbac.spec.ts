import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../generated/prisma';
import { AuditController } from './audit.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('AuditController — RBAC & Authorization Tests', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  function createMockContext(handler: Function, user?: any): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => AuditController,
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

  it('restricts AuditController to ADMIN role only', () => {
    const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      AuditController.prototype.getAuditLogs,
      AuditController,
    ]);
    expect(roles).toEqual([UserRole.ADMIN]);
    expect(roles).not.toContain(UserRole.MANAGER);
    expect(roles).not.toContain(UserRole.STAFF);
    expect(roles).not.toContain(UserRole.CUSTOMER);
  });

  it('permits ADMIN user to access audit logs endpoints', () => {
    const adminUser = { id: 'admin-1', role: UserRole.ADMIN };

    const ctxLogs = createMockContext(AuditController.prototype.getAuditLogs, adminUser);
    expect(rolesGuard.canActivate(ctxLogs)).toBe(true);

    const ctxSummary = createMockContext(AuditController.prototype.getSummary, adminUser);
    expect(rolesGuard.canActivate(ctxSummary)).toBe(true);

    const ctxDetail = createMockContext(AuditController.prototype.getAuditLogById, adminUser);
    expect(rolesGuard.canActivate(ctxDetail)).toBe(true);
  });

  it('rejects MANAGER user with ForbiddenException', () => {
    const managerUser = { id: 'mgr-1', role: UserRole.MANAGER };
    const ctx = createMockContext(AuditController.prototype.getAuditLogs, managerUser);
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects STAFF user with ForbiddenException', () => {
    const staffUser = { id: 'staff-1', role: UserRole.STAFF };
    const ctx = createMockContext(AuditController.prototype.getAuditLogs, staffUser);
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects CUSTOMER user with ForbiddenException', () => {
    const customerUser = { id: 'cust-1', role: UserRole.CUSTOMER };
    const ctx = createMockContext(AuditController.prototype.getAuditLogs, customerUser);
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects unauthenticated user without session with ForbiddenException', () => {
    const ctx = createMockContext(AuditController.prototype.getAuditLogs, undefined);
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
