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
    return apiClient.get<{ success: boolean; data: DynamicRole[] }>('/admin/roles');
  },

  /**
   * Get role details with assigned permissions and users.
   */
  async getRole(id: string): Promise<{ success: boolean; data: DynamicRole }> {
    return apiClient.get<{ success: boolean; data: DynamicRole }>(`/admin/roles/${id}`);
  },

  /**
   * List all 38 system permissions grouped by category.
   */
  async getPermissions(): Promise<{ success: boolean; data: Permission[] }> {
    return apiClient.get<{ success: boolean; data: Permission[] }>('/admin/roles/permissions');
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
  async deleteRole(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(`/admin/roles/${id}`);
  },

  /**
   * Overwrite permission assignments for a role (Super Admin only).
   */
  async assignPermissions(id: string, permissionKeys: string[]): Promise<{ success: boolean; message: string; data: any }> {
    return apiClient.put<{ success: boolean; message: string; data: any }>(`/admin/roles/${id}/permissions`, { permissionKeys });
  },
};

