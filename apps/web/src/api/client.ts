import axios from 'axios';
import type { AxiosError } from 'axios';

const API_URL = import.meta.env['VITE_API_URL'] as string | undefined ?? '/api';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      try {
        await apiClient.post('/auth/refresh');
        return apiClient(originalRequest);
      } catch {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);
