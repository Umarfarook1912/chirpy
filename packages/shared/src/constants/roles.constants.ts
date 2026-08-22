import type { UserRole } from '../types/user.types';

export const ROLES = {
  OWNER: 'owner' as UserRole,
  ADMIN: 'admin' as UserRole,
  MANAGER: 'manager' as UserRole,
  MEMBER: 'member' as UserRole,
} as const;

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
};

export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}
