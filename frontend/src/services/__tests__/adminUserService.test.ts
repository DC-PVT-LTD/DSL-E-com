import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminUserService } from '../adminUserService';
import { apiClient } from '@/lib/api/apiClient';

describe('adminUserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAdminUsers calls GET /admin/users with formatted query string', async () => {
    const mockRes = {
      success: true,
      data: [{ id: 'u1', name: 'Admin One', role: 'ADMIN', isActive: true }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockRes as any);

    const result = await adminUserService.getAdminUsers({
      search: 'kamal',
      role: 'ADMIN',
      isActive: true,
      page: 1,
      limit: 20,
    });

    expect(getSpy).toHaveBeenCalledWith('/admin/users?search=kamal&role=ADMIN&isActive=true&page=1&limit=20');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Admin One');
  });

  it('createAdminUser calls POST /admin/users with payload', async () => {
    const payload = {
      name: 'Kasun Silva',
      email: 'kasun@dsl.lk',
      role: 'STAFF' as const,
      password: 'SecurePassword123!',
    };
    const mockRes = { success: true, message: 'Created', data: { id: 'u2', ...payload, isActive: true } };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockRes as any);

    const result = await adminUserService.createAdminUser(payload);
    expect(postSpy).toHaveBeenCalledWith('/admin/users', payload);
    expect(result.success).toBe(true);
  });

  it('inviteAdminUser calls POST /admin/users/invite', async () => {
    const payload = {
      name: 'Nimal Perera',
      email: 'nimal@dsl.lk',
      role: 'MANAGER' as const,
    };
    const mockRes = { success: true, message: 'Invited', data: { id: 'inv-1', ...payload } };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockRes as any);

    const result = await adminUserService.inviteAdminUser(payload);
    expect(postSpy).toHaveBeenCalledWith('/admin/users/invite', payload);
    expect(result.success).toBe(true);
  });

  it('updateAdminStatus calls PATCH /admin/users/:id/status', async () => {
    const mockRes = { success: true, message: 'Status updated', data: { id: 'u1', isActive: false } };
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockRes as any);

    const result = await adminUserService.updateAdminStatus('u1', false);
    expect(patchSpy).toHaveBeenCalledWith('/admin/users/u1/status', { isActive: false });
    expect(result.success).toBe(true);
  });

  it('updateAdminRole calls PATCH /admin/users/:id/role', async () => {
    const mockRes = { success: true, message: 'Role updated', data: { id: 'u1', role: 'ADMIN' } };
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockRes as any);

    const result = await adminUserService.updateAdminRole('u1', 'ADMIN');
    expect(patchSpy).toHaveBeenCalledWith('/admin/users/u1/role', { role: 'ADMIN' });
    expect(result.success).toBe(true);
  });

  it('verifyInvitation calls GET /auth/admin/invite/verify with URL-encoded token', async () => {
    const mockRes = {
      success: true,
      data: {
        email: 'invited@dsl.lk',
        name: 'Invited User',
        role: 'STAFF',
        expiresAt: '2026-11-08T10:00:00.000Z',
        invitedBy: 'Super Admin',
      },
    };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockRes as any);

    const result = await adminUserService.verifyInvitation('test+token=123');
    expect(getSpy).toHaveBeenCalledWith('/auth/admin/invite/verify?token=test%2Btoken%3D123');
    expect(result.data.email).toBe('invited@dsl.lk');
  });

  it('acceptInvitation calls POST /auth/admin/invite/accept', async () => {
    const payload = { token: 'raw_token_xyz', password: 'NewSecurePassword123!' };
    const mockRes = { success: true, message: 'Accepted', data: { id: 'u3' } };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockRes as any);

    const result = await adminUserService.acceptInvitation(payload);
    expect(postSpy).toHaveBeenCalledWith('/auth/admin/invite/accept', payload);
    expect(result.success).toBe(true);
  });
});

