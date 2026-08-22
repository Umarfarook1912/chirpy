import type { Request, Response, NextFunction } from 'express';
import { ReportService } from '../../services/ReportService';
import { sendSuccess } from '../../utils/response.utils';

const reportService = new ReportService();

export const reportController = {
  async getMeetingReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await reportService.getMeetingReport(req.user!, req.params['meetingId']!);
      sendSuccess(res, { report });
    } catch (err) {
      next(err);
    }
  },

  async getOrganizationReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { periodStart, periodEnd } = req.query as { periodStart: string; periodEnd: string };
      const report = await reportService.getOrganizationReport(req.user!, periodStart, periodEnd);
      sendSuccess(res, { report });
    } catch (err) {
      next(err);
    }
  },
};
