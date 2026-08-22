import type { MeetingStatus, MeetingPlatform } from '../types/meeting.types';

export const MEETING_STATUS = {
  SCHEDULED: 'scheduled' as MeetingStatus,
  ACTIVE: 'active' as MeetingStatus,
  COMPLETED: 'completed' as MeetingStatus,
  CANCELLED: 'cancelled' as MeetingStatus,
} as const;

export const MEETING_PLATFORM = {
  GOOGLE_MEET: 'google_meet' as MeetingPlatform,
  TEAMS: 'teams' as MeetingPlatform,
  ZOOM: 'zoom' as MeetingPlatform,
  OTHER: 'other' as MeetingPlatform,
} as const;

export const MEETING_PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  google_meet: 'Google Meet',
  teams: 'Microsoft Teams',
  zoom: 'Zoom',
  other: 'Other',
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const MEETING_LIMITS = {
  TITLE_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 1000,
  MAX_PARTICIPANTS_PER_SESSION: 500,
  MAX_MEETINGS_PER_PAGE: 100,
  DEFAULT_MEETINGS_PER_PAGE: 20,
} as const;

export const GOOGLE_MEET_URL_PATTERN = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?.*)?$/;
