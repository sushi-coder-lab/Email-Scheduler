import { prisma } from '../../config/database.js';
import { CreateCampaignInput } from './campaigns.schema.js';
import { AppError } from '../../middleware/error.middleware.js';

export class CampaignsService {
  async listCampaigns(tenantId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { emailJobs: true },
        },
      },
    });

    const campaignsWithStats = await Promise.all(
      campaigns.map(async (c) => {
        const [sent, failed, scheduled] = await Promise.all([
          prisma.emailJob.count({ where: { campaignId: c.id, status: 'SENT' } }),
          prisma.emailJob.count({ where: { campaignId: c.id, status: 'FAILED' } }),
          prisma.emailJob.count({
            where: {
              campaignId: c.id,
              status: { in: ['SCHEDULED', 'QUEUED', 'PROCESSING', 'RETRYING'] },
            },
          }),
        ]);

        return {
          id: c.id,
          name: c.name,
          subject: c.subject,
          startTime: c.startTime,
          minDelayMs: c.minDelayMs,
          hourlyLimit: c.hourlyLimit,
          createdAt: c.createdAt,
          totalEmails: c._count.emailJobs,
          sentCount: sent,
          failedCount: failed,
          scheduledCount: scheduled,
        };
      })
    );

    return campaignsWithStats;
  }

  async getCampaignById(tenantId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        _count: {
          select: { emailJobs: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    return campaign;
  }

  async createCampaign(tenantId: string, input: CreateCampaignInput) {
    // Verify sender exists and belongs to tenant
    const sender = await prisma.emailSender.findFirst({
      where: { id: input.senderId, tenantId, isActive: true },
    });

    if (!sender) {
      throw new AppError('Sender not found or inactive', 400, 'INVALID_SENDER');
    }

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: input.name,
        subject: input.subject,
        body: input.body,
        startTime: new Date(input.startTime),
        minDelayMs: input.minDelayMs,
        hourlyLimit: input.hourlyLimit,
      },
    });

    return campaign;
  }
}

export const campaignsService = new CampaignsService();
