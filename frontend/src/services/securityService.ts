import { apiClient } from '@/lib/api/apiClient';

export interface VerificationChallengeItem {
  id: string;
  action: string;
  status: 'PENDING' | 'VERIFIED' | 'CONSUMED' | 'EXPIRED' | 'FAILED';
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, any> | null;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  verifiedAt?: string | null;
  consumedAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleName?: string | null;
  };
}

export interface AdminActivityItem {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  challengeId?: string | null;
  createdAt: string;
}

export interface ChallengeResponse {
  challengeId: string;
  action: string;
  expiresAt: string;
  emailMasked: string;
  maxAttempts: number;
  message: string;
}

export interface ConfirmResponse {
  verified: boolean;
  challengeId: string;
  action: string;
  verificationToken?: string;
  message: string;
}

export const securityService = {
  /**
   * Generates a step-up double verification challenge and emails 6-digit OTP.
   */
  async createChallenge(data: {
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; data: ChallengeResponse; message: string }> {
    const res = await apiClient.post<any>('/admin/security/verify/challenge', data);
    return {
      success: true,
      data: res.data || res,
      message: res.message || 'Verification code emailed successfully.',
    };
  },

  /**
   * Confirms a 6-digit OTP code against the active challenge.
   */
  async confirmChallenge(data: {
    challengeId: string;
    code: string;
  }): Promise<{ success: boolean; data: ConfirmResponse; message: string }> {
    const res = await apiClient.post<any>('/admin/security/verify/confirm', data);
    return {
      success: true,
      data: res.data || res,
      message: res.message || 'Verification confirmed successfully.',
    };
  },

  /**
   * Fetches paginated security challenges (Super Admin only).
   */
  async getChallenges(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{
    data: VerificationChallengeItem[];
    meta: { page: number; limit: number; totalItems: number; totalPages: number };
  }> {
    const res = await apiClient.get<any>('/admin/security/challenges', { params });
    const payload = res.data || res;
    return {
      data: payload.data || [],
      meta: payload.meta || { page: 1, limit: 20, totalItems: 0, totalPages: 1 },
    };
  },

  /**
   * Fetches private administrator activity logs (Super Admin only).
   */
  async getAdminActivities(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: AdminActivityItem[];
    meta: { page: number; limit: number; totalItems: number; totalPages: number };
  }> {
    const res = await apiClient.get<any>('/audit-logs/admin-activities', { params });
    const payload = res.data || res;
    return {
      data: payload.data || payload.items || [],
      meta: payload.meta || { page: 1, limit: 20, totalItems: 0, totalPages: 1 },
    };
  },

  /**
   * Returns download URL for private administrator activities CSV export.
   */
  getActivitiesExportUrl(): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    return `${baseUrl}/audit-logs/admin-activities/export`;
  },

  /**
   * Downloads private administrator activities CSV.
   */
  async downloadActivitiesCsv(): Promise<void> {
    const url = this.getActivitiesExportUrl();
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') : null;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Export failed with status: ${res.status}`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `admin-activities-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};

