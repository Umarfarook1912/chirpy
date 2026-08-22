export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | undefined;
  role: UserRole;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'member';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | undefined;
  role: UserRole;
  organizationId: string;
  organizationName: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: UserRole;
}
