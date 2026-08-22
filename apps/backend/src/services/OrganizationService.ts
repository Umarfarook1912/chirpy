import { OrganizationRepository } from '../repositories/OrganizationRepository';
import { UserRepository } from '../repositories/UserRepository';
import { NotFoundError } from '../errors/NotFoundError';
import { AuthorizationError } from '../errors/AuthorizationError';
import type { Organization, OrganizationMember, AuthTokenPayload } from '@chirpy/shared';
import { ROLES } from '@chirpy/shared';

const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

export class OrganizationService {
  async getOrganization(user: AuthTokenPayload): Promise<Organization> {
    const org = await orgRepo.findById(user.organizationId);
    if (!org) throw new NotFoundError('Organization');

    const members = await userRepo.findByOrganization(user.organizationId);

    return {
      id: String(org._id),
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      ownerId: String(org.ownerId),
      memberCount: members.length,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  async getMembers(user: AuthTokenPayload): Promise<OrganizationMember[]> {
    const members = await userRepo.findByOrganization(user.organizationId);
    return members.map((m) => ({
      userId: String(m._id),
      displayName: m.displayName,
      email: m.email,
      avatarUrl: m.avatarUrl,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  async updateOrganization(
    user: AuthTokenPayload,
    data: Partial<{ name: string; logoUrl: string }>,
  ): Promise<Organization> {
    if (user.role !== ROLES.OWNER && user.role !== ROLES.ADMIN) {
      throw new AuthorizationError('Only owners and admins can update organization settings');
    }

    const updated = await orgRepo.update(user.organizationId, data);
    if (!updated) throw new NotFoundError('Organization');

    const members = await userRepo.findByOrganization(user.organizationId);

    return {
      id: String(updated._id),
      name: updated.name,
      slug: updated.slug,
      logoUrl: updated.logoUrl,
      ownerId: String(updated.ownerId),
      memberCount: members.length,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
