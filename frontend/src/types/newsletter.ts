export type NewsletterSubscriberStatus = 'PENDING' | 'VERIFIED' | 'UNSUBSCRIBED';

export type NewsletterConsentEventType =
  | 'CONSENT_GIVEN'
  | 'EMAIL_VERIFIED'
  | 'UNSUBSCRIBED'
  | 'RESUBSCRIPTION_REQUESTED';

export interface NewsletterConsentEvent {
  id: string;
  subscriberId: string;
  eventType: NewsletterConsentEventType;
  consentTextVersion: string;
  consentSource: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: NewsletterSubscriberStatus;
  consentGivenAt: string;
  consentSource: string;
  consentTextVersion: string;
  verifiedAt?: string | null;
  unsubscribedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterCounts {
  total: number;
  verified: number;
  pending: number;
  unsubscribed: number;
}

export interface AdminSubscribersResponse {
  items: NewsletterSubscriber[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  counts: NewsletterCounts;
}

export interface UnsubscribeInfo {
  maskedEmail: string;
  status: NewsletterSubscriberStatus;
  isUnsubscribed: boolean;
}

