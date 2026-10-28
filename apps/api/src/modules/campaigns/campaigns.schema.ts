import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').trim(),
  subject: z.string().min(1, 'Subject is required').trim(),
  body: z.string().min(1, 'Body is required'),
  senderId: z.string().uuid('Invalid sender ID'),
  startTime: z.string().datetime().or(z.date()),
  minDelayMs: z.number().int().min(100).default(2000),
  hourlyLimit: z.number().int().min(1).default(100),
  recipients: z.array(z.string().email()).optional(),
  idempotencyKey: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
