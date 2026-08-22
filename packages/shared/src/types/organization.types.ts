import type { UserRole } from './user.types';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | undefined;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | undefined;
  role: UserRole;
  joinedAt: string;
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: string;
  createdAt: string;
}
