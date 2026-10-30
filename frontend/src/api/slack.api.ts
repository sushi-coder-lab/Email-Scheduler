import { apiClient } from './client';

export interface SlackStatusResponse {
  connected: boolean;
  teamName?: string;
  channelName?: string;
  createdAt?: string;
}

export const slackApi = {
  getStatus: () => apiClient<SlackStatusResponse>('/api/slack/connection'),
  disconnect: () =>
    apiClient<{ message: string }>('/api/slack/connection', {
      method: 'DELETE',
    }),
  getConnectUrl: () => '/api/slack/connect',
};
