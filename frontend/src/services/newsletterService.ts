import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';
import {
  NewsletterSubscriber,
  NewsletterConsentEvent,
  AdminSubscribersResponse,
  UnsubscribeInfo,
  NewsletterSubscriberStatus,
} from '@/types/newsletter';

class NewsletterService {
  /**
   * Public: Subscribe to newsletter with affirmative consent.
   */
  public async subscribe(
    email: string,
    consent: boolean,
    source: string = 'WEBSITE_FOOTER'
  ): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<BackendApiResponse<null>>('newsletter/subscribe', {
      email,
      consent,
      source,
    });
    return {
      success: res.success ?? true,
      message: res.message || 'If your email is valid, a verification link has been sent.',
    };
  }

  /**
   * Public: Verify email with double opt-in token.
   */
  public async verify(token: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.get<BackendApiResponse<{ verified: boolean }>>('newsletter/verify', {
      params: { token },
    });
    return {
      success: res.success ?? true,
      message: res.message || 'Your email address has been successfully verified!',
    };
  }

  /**
   * Public: Resend double opt-in verification link.
   */
  public async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<BackendApiResponse<null>>('newsletter/resend-verification', {
      email,
    });
    return {
      success: res.success ?? true,
      message: res.message || 'If eligible, a new confirmation link has been sent.',
    };
  }

  /**
   * Public: Check unsubscribe token status.
   */
  public async getUnsubscribeInfo(token: string): Promise<UnsubscribeInfo> {
    const res = await apiClient.get<BackendApiResponse<UnsubscribeInfo>>('newsletter/unsubscribe', {
      params: { token },
    });
    if (!res.data) {
      throw new Error(res.message || 'Invalid unsubscribe link');
    }
    return res.data;
  }

  /**
   * Public: Process unsubscribe request.
   */
  public async unsubscribe(token: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<BackendApiResponse<{ unsubscribed: boolean }>>('newsletter/unsubscribe', {
      token,
    });
    return {
      success: res.success ?? true,
      message: res.message || 'You have been successfully unsubscribed.',
    };
  }

  /**
   * Admin: List subscribers with filters and status breakdown.
   */
  public async getAdminSubscribers(params?: {
    page?: number;
    limit?: number;
    status?: 'ALL' | NewsletterSubscriberStatus;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<AdminSubscribersResponse> {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.status && params.status !== 'ALL') queryParams.status = params.status;
    if (params?.search && params.search.trim()) queryParams.search = params.search.trim();
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;

    const res = await apiClient.get<BackendApiResponse<AdminSubscribersResponse>>('admin/newsletter/subscribers', {
      params: queryParams,
    });

    if (!res.data) {
      return {
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        counts: {
          total: 0,
          verified: 0,
          pending: 0,
          unsubscribed: 0,
        },
      };
    }

    return res.data;
  }

  /**
   * Admin: Get single subscriber details.
   */
  public async getAdminSubscriberById(id: string): Promise<NewsletterSubscriber> {
    const res = await apiClient.get<BackendApiResponse<NewsletterSubscriber>>(
      `admin/newsletter/subscribers/${encodeURIComponent(id)}`
    );
    if (!res.data) {
      throw new Error(res.message || 'Subscriber not found');
    }
    return res.data;
  }

  /**
   * Admin: Get consent audit history for a subscriber.
   */
  public async getAdminConsentHistory(id: string): Promise<{
    subscriberId: string;
    email: string;
    events: NewsletterConsentEvent[];
  }> {
    const res = await apiClient.get<
      BackendApiResponse<{
        subscriberId: string;
        email: string;
        events: NewsletterConsentEvent[];
      }>
    >(`admin/newsletter/subscribers/${encodeURIComponent(id)}/consent-history`);

    if (!res.data) {
      throw new Error(res.message || 'Consent history not found');
    }
    return res.data;
  }

  /**
   * Admin: Export eligible subscribers as CSV.
   * Downloads the file directly in the browser.
   */
  public async downloadExportCsv(): Promise<void> {
    const csvContent = await apiClient.get<string>('admin/newsletter/export');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dsl-newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const newsletterService = new NewsletterService();

