import { apiClient } from '@/lib/api/apiClient';

export interface Permission {
  id: string;
  key: string;
  displayName: string;
  category: string;
  description?: string | null;
}

export interface DynamicRole {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions?: Array<{
    permission: Permission;
  }>;
  users?: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  }>;
  _count?: {
    users: number;
    permissions: number;
  };
}

export interface CreateRolePayload {
  name: string;
  slug: string;
  description?: string;
  permissionKeys: string[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export const rolesService = {
  /**
   * List all dynamic roles with permission and user counts.
   */
  async getRoles(): Promise<{ success: boolean; data: DynamicRole[] }> {
    const res = await apiClient.get<any>('/admin/roles');
    const data = Array.isArray(res) ? res : res?.data || [];
    return { success: true, data };
  },

  /**
   * Get role details with assigned permissions and users.
   */
  async getRole(id: string): Promise<{ success: boolean; data: DynamicRole }> {
    const res = await apiClient.get<any>(`/admin/roles/${id}`);
    const data = res?.data || res;
    return { success: true, data };
  },

  /**
   * List all system permissions grouped by category.
   */
  async getPermissions(): Promise<{ success: boolean; data: Permission[] }> {
    const res = await apiClient.get<any>('/admin/roles/permissions');
    const data = Array.isArray(res) ? res : res?.data || [];
    return { success: true, data };
  },

  /**
   * Create a new custom role (Super Admin only).
   */
  async createRole(payload: CreateRolePayload): Promise<{ success: boolean; message: string; data: DynamicRole }> {
    return apiClient.post<{ success: boolean; message: string; data: DynamicRole }>('/admin/roles', payload);
  },

  /**
   * Update an existing custom role (Super Admin only).
   */
  async updateRole(id: string, payload: UpdateRolePayload): Promise<{ success: boolean; message: string; data: DynamicRole }> {
    return apiClient.patch<{ success: boolean; message: string; data: DynamicRole }>(`/admin/roles/${id}`, payload);
  },

  /**
   * Delete an unassigned custom role (Super Admin only).
   */
  async deleteRole(id: string, confirmationPhrase?: string): Promise<{ success: boolean; message: string }> {
    const options = confirmationPhrase
      ? { headers: { 'x-action-confirmation': confirmationPhrase } }
      : undefined;
    return apiClient.delete<{ success: boolean; message: string }>(`/admin/roles/${id}`, options);
  },

  /**
   * Overwrite permission assignments for a role (Super Admin only).
   */
  async assignPermissions(
    id: string,
    permissionKeys: string[],
    confirmationPhrase?: string
  ): Promise<{ success: boolean; message: string; data: any }> {
    const options = confirmationPhrase
      ? { headers: { 'x-action-confirmation': confirmationPhrase } }
      : undefined;
    return apiClient.put<{ success: boolean; message: string; data: any }>(
      `/admin/roles/${id}/permissions`,
      { permissionKeys },
      options
    );
  },

  /**
   * Get role audit history.
   */
  async getAuditHistory(id: string): Promise<{ success: boolean; data: any[] }> {
    return apiClient.get<{ success: boolean; data: any[] }>(`/admin/roles/${id}/audit-history`);
  },

  /**
   * Get roles export download URL.
   */
  getExportUrl(format: 'csv' | 'xlsx' = 'csv'): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    return `${baseUrl}/admin/roles/export?format=${format}`;
  },
};

