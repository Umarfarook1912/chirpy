import { UserModel, type UserDocument } from '../models/User.model';
import type { UserRole } from '@chirpy/shared';
import type { Types } from 'mongoose';

export class UserRepository {
  async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  }

  async findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).select('+passwordHash +refreshTokenHash').exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase() })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  async findByOrganization(organizationId: string): Promise<UserDocument[]> {
    return UserModel.find({ organizationId }).exec();
  }

  async create(data: {
    email: string;
    passwordHash: string;
    displayName: string;
    role: UserRole;
    organizationId: Types.ObjectId;
  }): Promise<UserDocument> {
    return UserModel.create(data);
  }

  async updateRefreshTokenHash(userId: string, hash: string | null): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { refreshTokenHash: hash }).exec();
  }

  async updateRole(userId: string, role: UserRole): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(userId, { role }, { new: true }).exec();
  }
}
