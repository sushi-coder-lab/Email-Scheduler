import { apiClient } from './client';

export interface EmailJobItem {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'RETRYING' | 'DELIVERY_UNKNOWN';
  scheduledTime: string;
  sentAt?: string | null;
  attemptCount: number;
  lastError?: string | null;
  smtpPreviewUrl?: string | null;
  createdAt: string;
  sender?: {
    displayName: string;
    senderEmail: string;
  };
  campaign?: {
    id: string;
    name: string;
  } | null;
}

export interface EmailListResponse {
  items: EmailJobItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadUploadResponse {
  filename: string;
  totalDetected: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  validEmails: string[];
  preview: Array<{ email: string; isValid: boolean; reason?: string }>;
}

export interface DashboardMetrics {
  scheduledCount: number;
  sentCount: number;
  failedCount: number;
  processingCount: number;
  queue: {
    waiting: number;
    delayed: number;
    active: number;
  };
}

export const emailsApi = {
  listScheduled: (params?: { page?: number; limit?: number; search?: string; senderId?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.senderId) query.set('senderId', params.senderId);
    return apiClient<EmailListResponse>(`/api/emails/scheduled?${query.toString()}`);
  },

  listSent: (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    return apiClient<EmailListResponse>(`/api/emails/sent?${query.toString()}`);
  },

  getMetrics: () => apiClient<DashboardMetrics>('/api/emails/metrics'),

  getById: (id: string) => apiClient<{ email: EmailJobItem }>(`/api/emails/${id}`),

  cancel: (id: string) =>
    apiClient<{ message: string; email: EmailJobItem }>(`/api/emails/${id}/cancel`, {
      method: 'POST',
    }),

  uploadLeads: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient<LeadUploadResponse>('/api/emails/upload-leads', {
      method: 'POST',
      body: formData,
    });
  },

  schedule: (data: {
    campaignId?: string;
    senderId: string;
    subject: string;
    body: string;
    scheduledTime: string;
    recipients: string[];
    idempotencyKey?: string;
    customMinDelayMs?: number;
    customHourlyLimit?: number;
  }) =>
    apiClient<{ scheduledCount: number; emailJobs: EmailJobItem[]; idempotent?: boolean }>('/api/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
