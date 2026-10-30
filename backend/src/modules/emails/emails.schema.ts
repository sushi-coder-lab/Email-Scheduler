import { z } from 'zod';

export const scheduleEmailSchema = z.object({
  campaignId: z.string().uuid().optional(),
  senderId: z.string().uuid('Valid senderId required'),
  subject: z.string().min(1, 'Subject is required').trim(),
  body: z.string().min(1, 'Body is required'),
  scheduledTime: z.string().datetime().or(z.date()),
  recipients: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required'),
  idempotencyKey: z.string().optional(),
  customMinDelayMs: z.number().int().min(100).optional(),
  customHourlyLimit: z.number().int().min(1).optional(),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;

export const emailListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  senderId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type EmailListQuery = z.infer<typeof emailListQuerySchema>;
