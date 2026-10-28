export interface EmailJobData {
  emailJobId: string;
  tenantId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string;
  attempt: number;
  correlationId?: string;
  customHourlyLimit?: number;
  customMinDelayMs?: number;
}

export const EMAIL_QUEUE_NAME = 'email-queue';
