export const EXTENSION_CONSTANTS = {
  DB_NAME: 'chirpy-extension',
  DB_VERSION: 1,

  SYNC_RETRY_LIMIT: 3,
  SYNC_RETRY_DELAY_MS: 5_000,
  SYNC_DEBOUNCE_MS: 2_000,

  SPEAKING_THRESHOLD_DB: -40,
  SPEAKING_MIN_DURATION_MS: 500,

  GOOGLE_MEET_HOST: 'meet.google.com',
  GOOGLE_MEET_URL_PATTERN: /^https:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/,

  STORAGE_KEY_AUTH: 'chirpy_auth',
  STORAGE_KEY_CURRENT_SESSION: 'chirpy_current_session',

  API_BASE_URL: 'http://localhost:3001/api',
} as const;
