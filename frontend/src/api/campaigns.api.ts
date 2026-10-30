import { apiClient } from './client';

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  startTime: string;
  minDelayMs: number;
  hourlyLimit: number;
  createdAt: string;
  totalEmails: number;
  sentCount: number;
  failedCount: number;
  scheduledCount: number;
}

export const campaignsApi = {
  list: () => apiClient<{ campaigns: Campaign[] }>('/api/campaigns'),
  getById: (id: string) => apiClient<{ campaign: Campaign }>(`/api/campaigns/${id}`),
  create: (data: {
    name: string;
    subject: string;
    body: string;
    senderId: string;
    startTime: string;
    minDelayMs?: number;
    hourlyLimit?: number;
  }) =>
    apiClient<{ campaign: Campaign }>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
