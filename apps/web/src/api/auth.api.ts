import { apiClient } from './client';
import type { RegisterInput, LoginInput, UserProfile } from '@chirpy/shared';

export const authApi = {
  async register(data: RegisterInput): Promise<{ profile: UserProfile }> {
    const res = await apiClient.post<{ success: true; data: { profile: UserProfile } }>('/auth/register', data);
    return res.data.data;
  },

  async login(data: LoginInput): Promise<{ profile: UserProfile }> {
    const res = await apiClient.post<{ success: true; data: { profile: UserProfile } }>('/auth/login', data);
    return res.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async me(): Promise<UserProfile | null> {
    try {
      const res = await apiClient.get<{ success: true; data: { user: UserProfile } }>('/auth/me');
      return res.data.data.user;
    } catch {
      return null;
    }
  },
};
