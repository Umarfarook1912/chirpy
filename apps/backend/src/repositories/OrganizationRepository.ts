import { OrganizationModel, type OrganizationDocument } from '../models/Organization.model';
import type { Types } from 'mongoose';

export class OrganizationRepository {
  async findById(id: string): Promise<OrganizationDocument | null> {
    return OrganizationModel.findById(id).exec();
  }

  async findBySlug(slug: string): Promise<OrganizationDocument | null> {
    return OrganizationModel.findOne({ slug: slug.toLowerCase() }).exec();
  }

  async create(data: {
    name: string;
    slug: string;
    ownerId?: Types.ObjectId;
  }): Promise<OrganizationDocument> {
    return OrganizationModel.create(data);
  }

  async update(
    id: string,
    data: Partial<{ name: string; logoUrl: string; ownerId: Types.ObjectId }>,
  ): Promise<OrganizationDocument | null> {
    return OrganizationModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }
}
