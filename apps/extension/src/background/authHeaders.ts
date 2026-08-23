import { EXTENSION_CONSTANTS } from '../constants/extension.constants';

const AUTH_COOKIE_URLS = [
  'http://localhost:5173',
  EXTENSION_CONSTANTS.API_BASE_URL.replace(/\/api$/, ''),
];

async function readAccessTokenCookie(): Promise<string | undefined> {
  for (const url of AUTH_COOKIE_URLS) {
    const cookie = await chrome.cookies.get({ url, name: 'accessToken' });
    if (cookie?.value) return cookie.value;
  }

  const localhostCookies = await chrome.cookies.getAll({ domain: 'localhost' });
  return localhostCookies.find((c) => c.name === 'accessToken')?.value;
}

async function readRefreshTokenCookie(): Promise<string | undefined> {
  for (const url of AUTH_COOKIE_URLS) {
    const cookie = await chrome.cookies.get({ url, name: 'refreshToken' });
    if (cookie?.value) return cookie.value;
  }

  const localhostCookies = await chrome.cookies.getAll({ domain: 'localhost' });
  return localhostCookies.find((c) => c.name === 'refreshToken')?.value;
}

export async function getSyncAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await readAccessTokenCookie();
  if (accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  const refreshToken = await readRefreshTokenCookie();
  if (!refreshToken) return {};

  try {
    const response = await fetch(`${EXTENSION_CONSTANTS.API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    });

    if (!response.ok) return {};

    const body = (await response.json()) as { data?: { accessToken?: string } };
    if (body.data?.accessToken) {
      return { Authorization: `Bearer ${body.data.accessToken}` };
    }

    const refreshedToken = await readAccessTokenCookie();
    if (refreshedToken) {
      return { Authorization: `Bearer ${refreshedToken}` };
    }
  } catch {
    /* refresh failed */
  }

  return {};
}
