import { apiClient } from './client';
import { EmailJobItem } from './emails.api';

export interface SearchResponse {
  items: EmailJobItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: 'elasticsearch' | 'database';
}

export const searchApi = {
  search: (params: { q?: string; status?: string; senderId?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.status) query.set('status', params.status);
    if (params.senderId) query.set('senderId', params.senderId);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return apiClient<SearchResponse>(`/api/search/emails?${query.toString()}`);
  },
  reindex: () => apiClient<{ message: string; indexedCount: number }>('/api/search/reindex', { method: 'POST' }),
};
