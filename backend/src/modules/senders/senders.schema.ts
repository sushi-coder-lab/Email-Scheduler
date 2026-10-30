import { z } from 'zod';

export const createSenderSchema = z.object({
  senderEmail: z.string().email('Invalid email address').toLowerCase().trim(),
  displayName: z.string().min(1, 'Display name is required').trim(),
  providerConfig: z
    .object({
      host: z.string().optional(),
      port: z.number().optional(),
      user: z.string().optional(),
      pass: z.string().optional(),
    })
    .optional(),
});

export type CreateSenderInput = z.infer<typeof createSenderSchema>;
