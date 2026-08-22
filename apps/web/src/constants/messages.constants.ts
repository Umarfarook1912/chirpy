export const MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: 'Welcome back!',
    REGISTER_SUCCESS: 'Account created successfully',
    LOGOUT_SUCCESS: 'Logged out successfully',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  },
  MEETING: {
    CREATED: 'Meeting created successfully',
    UPDATED: 'Meeting updated successfully',
    NO_MEETINGS: 'No meetings found',
    NO_MEETINGS_HINT: 'Meetings will appear here after you join them via the CHIRPY Chrome extension.',
  },
  ERRORS: {
    GENERIC: 'Something went wrong. Please try again.',
    NETWORK: 'Network error. Please check your connection.',
    UNAUTHORIZED: 'You do not have permission to do that.',
    NOT_FOUND: 'The requested resource was not found.',
  },
  LOADING: 'Loading...',
  SAVING: 'Saving...',
  EMPTY_STATE: 'Nothing here yet',
} as const;
