import { prisma } from '../../config/database.js';
import { CreateSenderInput } from './senders.schema.js';
import { AppError } from '../../middleware/error.middleware.js';
import { encrypt } from '../../utils/crypto.js';

export class SendersService {
  async listSenders(tenantId: string) {
    return prisma.emailSender.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        senderEmail: true,
        displayName: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async getSenderById(tenantId: string, id: string) {
    const sender = await prisma.emailSender.findFirst({
      where: { id, tenantId },
    });
    if (!sender) {
      throw new AppError('Sender not found', 404, 'SENDER_NOT_FOUND');
    }
    return sender;
  }

  async createSender(tenantId: string, input: CreateSenderInput) {
    const existing = await prisma.emailSender.findUnique({
      where: {
        tenantId_senderEmail: {
          tenantId,
          senderEmail: input.senderEmail,
        },
      },
    });

    if (existing) {
      if (!existing.isActive) {
        return prisma.emailSender.update({
          where: { id: existing.id },
          data: { isActive: true, displayName: input.displayName },
        });
      }
      throw new AppError('A sender with this email already exists in your workspace', 409, 'SENDER_EXISTS');
    }

    let providerConfigJson = undefined;
    if (input.providerConfig) {
      providerConfigJson = {
        ...input.providerConfig,
        pass: input.providerConfig.pass ? encrypt(input.providerConfig.pass) : undefined,
      };
    }

    return prisma.emailSender.create({
      data: {
        tenantId,
        senderEmail: input.senderEmail,
        displayName: input.displayName,
        providerConfig: providerConfigJson,
        isActive: true,
      },
      select: {
        id: true,
        senderEmail: true,
        displayName: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}

export const sendersService = new SendersService();
