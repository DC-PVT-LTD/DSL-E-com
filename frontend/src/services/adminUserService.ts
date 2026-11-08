import { apiClient } from '@/lib/api/apiClient';
import { DynamicRole } from './rolesService';

export type AdminRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: AdminRole;
  roleId?: string | null;
  assignedRole?: DynamicRole | null;
  isActive: boolean;
  isEmailVerified: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminInvitation {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: AdminRole;
  roleId?: string | null;
  roleRelation?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  expiresAt: string;
  createdAt: string;
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateAdminPayload {
  email: string;
  name: string;
  phone?: string;
  role?: AdminRole;
  roleId?: string;
  password: string;
}

export interface InviteAdminPayload {
  email: string;
  name: string;
  phone?: string;
  role?: AdminRole;
  roleId?: string;
}

export interface AdminUsersQuery {
  search?: string;
  role?: AdminRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminUsersListResponse {
  success: boolean;
  data: AdminUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface VerifyInvitationResponse {
  success: boolean;
  data: {
    email: string;
    name: string;
    role: AdminRole;
    expiresAt: string;
    invitedBy: string;
  };
}

export const adminUserService = {
  /**
   * List administrators with search and filters.
   */
  async getAdminUsers(query?: AdminUsersQuery): Promise<AdminUsersListResponse> {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.role) params.set('role', query.role);
    if (query?.isActive !== undefined) params.set('isActive', String(query.isActive));
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<AdminUsersListResponse>(`/admin/users${qs}`);
  },

  /**
   * Get administrator by id.
   */
  async getAdminUser(id: string): Promise<{ success: boolean; data: AdminUser }> {
    return apiClient.get<{ success: boolean; data: AdminUser }>(`/admin/users/${id}`);
  },

  /**
   * Directly create an administrator account.
   */
  async createAdminUser(payload: CreateAdminPayload): Promise<{ success: boolean; message: string; data: AdminUser }> {
    return apiClient.post<{ success: boolean; message: string; data: AdminUser }>('/admin/users', {
      ...payload,
      role: payload.role || 'ADMIN',
    });
  },

  /**
   * Send an administrator invitation email with single-use cryptographic token.
   */
  async inviteAdminUser(payload: InviteAdminPayload): Promise<{
    success: boolean;
    message: string;
    data: {
      id: string;
      email: string;
      name: string;
      role: AdminRole;
      roleId?: string | null;
      expiresAt: string;
      invitationUrl?: string;
    };
  }> {
    return apiClient.post('/admin/users/invite', {
      ...payload,
      role: payload.role || 'ADMIN',
    });
  },

  /**
   * Activate or deactivate an administrator.
   */
  async updateAdminStatus(id: string, isActive: boolean): Promise<{ success: boolean; message: string; data: AdminUser }> {
    return apiClient.patch<{ success: boolean; message: string; data: AdminUser }>(`/admin/users/${id}/status`, { isActive });
  },

  /**
   * Change administrator role and dynamic roleId.
   */
  async updateAdminRole(id: string, role: AdminRole, roleId?: string): Promise<{ success: boolean; message: string; data: AdminUser }> {
    return apiClient.patch<{ success: boolean; message: string; data: AdminUser }>(`/admin/users/${id}/role`, { role, roleId });
  },

  /**
   * List pending administrator invitations.
   */
  async getInvitations(): Promise<{ success: boolean; data: AdminInvitation[] }> {
    return apiClient.get<{ success: boolean; data: AdminInvitation[] }>('/admin/users/invitations');
  },

  /**
   * Revoke a pending invitation.
   */
  async revokeInvitation(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/admin/users/invitations/${id}`);
  },

  /**
   * Public: Verify an invitation token before showing the password creation form.
   */
  async verifyInvitation(token: string): Promise<VerifyInvitationResponse> {
    return apiClient.get<VerifyInvitationResponse>(`/auth/admin/invite/verify?token=${encodeURIComponent(token)}`);
  },

  /**
   * Public: Accept an invitation and establish administrator password.
   */
  async acceptInvitation(payload: { token: string; password: string }): Promise<{
    success: boolean;
    message: string;
    data: AdminUser;
  }> {
    return apiClient.post('/auth/admin/invite/accept', payload);
  },
};
