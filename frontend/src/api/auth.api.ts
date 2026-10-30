import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt?: string;
}

export interface Tenant {
  id: string;
  name: string;
  role: string;
}

export interface AuthMeResponse {
  user: User;
  tenant: Tenant;
}

export const authApi = {
  getMe: () => apiClient<AuthMeResponse>('/api/auth/me'),
  devLogin: (email?: string) =>
    apiClient<{ user: User; tenant: Tenant; message: string }>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  logout: () =>
    apiClient<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    }),
  getGoogleAuthUrl: () => '/api/auth/google',
};
