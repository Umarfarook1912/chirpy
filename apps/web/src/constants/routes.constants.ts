export const ROUTES = {
  HOME: '/',
  AUTH: {
    LOGIN: '/login',
    REGISTER: '/register',
  },
  DASHBOARD: '/dashboard',
  MEETINGS: {
    LIST: '/meetings',
    DETAIL: (id: string) => `/meetings/${id}`,
    DETAIL_PATTERN: '/meetings/:id',
  },
  ORGANIZATION: '/organization',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  ERROR: {
    NOT_FOUND: '/404',
    ERROR: '/error',
  },
} as const;
