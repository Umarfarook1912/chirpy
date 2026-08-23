import axios from 'axios';
import type { AxiosError } from 'axios';

function resolveApiBaseUrl(): string {
  const configuredUrl = import.meta.env['VITE_API_URL'] as string | undefined;

  // Dev default: Vite proxies /api -> backend
  if (!configuredUrl) {
    return '/api';
  }

  // Relative path (e.g. /api) — use as-is, don't append /api again
  if (configuredUrl.startsWith('/')) {
    return configuredUrl.replace(/\/$/, '');
  }

  // Absolute backend URL (e.g. http://localhost:3001)
  return `${configuredUrl.replace(/\/$/, '')}/api`;
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
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
    const requestUrl = originalRequest?.url ?? '';

    const skipTokenRefresh =
      requestUrl.includes('/auth/me') ||
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh');

    if (error.response?.status === 401 && originalRequest && !skipTokenRefresh) {
      const retried = (originalRequest as { _retry?: boolean })._retry;
      if (retried) {
        return Promise.reject(error);
      }
      (originalRequest as { _retry?: boolean })._retry = true;
      try {
        await apiClient.post('/auth/refresh');
        return apiClient(originalRequest);
      } catch {
        const onAuthPage =
          window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/register');
        if (!onAuthPage) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);
