import type { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '../../services/OrganizationService';
import { sendSuccess } from '../../utils/response.utils';

const orgService = new OrganizationService();

export const organizationController = {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organization = await orgService.getOrganization(req.user!);
      sendSuccess(res, { organization });
    } catch (err) {
      next(err);
    }
  },

  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const members = await orgService.getMembers(req.user!);
      sendSuccess(res, { members });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organization = await orgService.updateOrganization(req.user!, req.body);
      sendSuccess(res, { organization });
    } catch (err) {
      next(err);
    }
  },
};
