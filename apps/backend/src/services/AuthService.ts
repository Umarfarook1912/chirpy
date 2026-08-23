import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { UserRepository } from '../repositories/UserRepository';
import { OrganizationRepository } from '../repositories/OrganizationRepository';
import { AuthenticationError } from '../errors/AuthenticationError';
import { ConflictError } from '../errors/ConflictError';
import type { RegisterInput, LoginInput, AuthTokenPayload, UserProfile } from '@chirpy/shared';
import type { Types } from 'mongoose';

const userRepo = new UserRepository();
const orgRepo = new OrganizationRepository();

export class AuthService {
  async register(input: RegisterInput): Promise<{ profile: UserProfile; accessToken: string; refreshToken: string }> {
    const existing = await userRepo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email address already exists');
    }

    let slug = orgRepo.generateSlug(input.organizationName);
    const existingOrg = await orgRepo.findBySlug(slug);
    if (existingOrg) {
      slug = `${slug}-${Date.now()}`;
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    const org = await orgRepo.create({
      name: input.organizationName,
      slug,
    });

    const user = await userRepo.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      role: 'owner',
      organizationId: org._id as Types.ObjectId,
    });

    await orgRepo.update(String(org._id), { ownerId: user._id as Types.ObjectId });

    const { accessToken, refreshToken } = await this.generateTokenPair(user);

    return {
      profile: this.toProfile(user, org.name),
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput): Promise<{ profile: UserProfile; accessToken: string; refreshToken: string }> {
    const user = await userRepo.findByEmailWithPassword(input.email);
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new AuthenticationError('Invalid email or password');
    }

    const org = await orgRepo.findById(String(user.organizationId));
    const { accessToken, refreshToken } = await this.generateTokenPair(user);

    return {
      profile: this.toProfile(user, org?.name ?? ''),
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: AuthTokenPayload;
    try {
      payload = jwt.verify(refreshToken, ENV.REFRESH_SECRET) as AuthTokenPayload;
    } catch {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    const user = await userRepo.findByIdWithPassword(payload.userId);
    if (!user?.refreshTokenHash) {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    const valid = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!valid) {
      throw new AuthenticationError('Invalid refresh token');
    }

    return this.generateTokenPair(user);
  }

  async logout(userId: string): Promise<void> {
    await userRepo.updateRefreshTokenHash(userId, null);
  }

  private async generateTokenPair(user: { _id: unknown; email: string; organizationId: unknown; role: string }): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenPayload: AuthTokenPayload = {
      userId: String(user._id),
      email: user.email,
      organizationId: String(user.organizationId),
      role: user.role as AuthTokenPayload['role'],
    };

    const accessToken = jwt.sign(tokenPayload, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(tokenPayload, ENV.REFRESH_SECRET, {
      expiresIn: ENV.REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshTokenHash = await argon2.hash(refreshToken, { type: argon2.argon2id });
    await userRepo.updateRefreshTokenHash(String(user._id), refreshTokenHash);

    return { accessToken, refreshToken };
  }

  private toProfile(
    user: { _id: unknown; email: string; displayName: string; avatarUrl?: string; role: string; organizationId?: unknown },
    orgName: string,
  ): UserProfile {
    return {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role as UserProfile['role'],
      organizationId: user.organizationId ? String(user.organizationId) : '',
      organizationName: orgName,
    };
  }
}
