import type { ParticipantMetrics } from './participant.types';

export interface MeetingReport {
  meetingId: string;
  meetingTitle: string;
  startedAt: string;
  endedAt?: string | undefined;
  durationMinutes: number;
  totalParticipants: number;
  averageParticipationScore: number;
  highEngagementCount: number;
  mediumEngagementCount: number;
  lowEngagementCount: number;
  participants: ParticipantMetrics[];
}

export interface OrganizationReport {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  totalMeetings: number;
  totalParticipants: number;
  averageParticipationScore: number;
  meetingSummaries: MeetingReportSummary[];
}

export interface MeetingReportSummary {
  meetingId: string;
  title: string;
  date: string;
  participantCount: number;
  averageScore: number;
  durationMinutes: number;
}
