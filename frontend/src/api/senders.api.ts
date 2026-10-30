import { apiClient } from './client';

export interface EmailSender {
  id: string;
  senderEmail: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
}

export const sendersApi = {
  list: () => apiClient<{ senders: EmailSender[] }>('/api/senders'),
  create: (data: { senderEmail: string; displayName: string }) =>
    apiClient<{ sender: EmailSender }>('/api/senders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
