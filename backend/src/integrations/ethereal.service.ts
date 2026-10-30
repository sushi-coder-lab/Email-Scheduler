import nodemailer, { Transporter, TestAccount } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendMailResult {
  messageId: string;
  response: string;
  previewUrl: string | false;
  accepted: string[];
  rejected: string[];
}

export class EtherealSmtpService {
  private transporter: Transporter | null = null;
  private testAccount: TestAccount | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.transporter) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        let user = env.ETHEREAL_USER;
        let pass = env.ETHEREAL_PASS;

        // Auto-provision an Ethereal test account if credentials not explicitly configured
        if (!user || !pass) {
          logger.info('No ETHEREAL credentials supplied in .env. Auto-generating development Ethereal account...');
          try {
            this.testAccount = await nodemailer.createTestAccount();
            user = this.testAccount.user;
            pass = this.testAccount.pass;
            logger.info({ user }, 'Generated Ethereal test account successfully');
          } catch (accErr) {
            logger.warn({ accErr }, 'Unable to auto-generate Ethereal account online (network isolated). Using development fallback credentials.');
            user = 'reachinbox-dev@ethereal.email';
            pass = 'reachinbox-dev-password';
          }
        }

        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user,
            pass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        // Verify SMTP connection
        try {
          await this.transporter.verify();
          logger.info('Ethereal SMTP transport verified and ready');
        } catch (err) {
          logger.warn({ err }, 'SMTP verification check failed (will retry on send)');
        }
      })();
    }

    await this.initPromise;
  }

  async sendMail(opts: SendMailOptions, customConfig?: { host?: string; port?: number; user?: string; pass?: string }): Promise<SendMailResult> {
    let transporter = this.transporter;

    if (customConfig && customConfig.user && customConfig.pass) {
      transporter = nodemailer.createTransport({
        host: customConfig.host || env.SMTP_HOST,
        port: customConfig.port || env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: customConfig.user,
          pass: customConfig.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    } else {
      if (!transporter) {
        await this.init();
        transporter = this.transporter!;
      }
    }

    try {
      const info = await transporter.sendMail({
        from: opts.from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text || opts.html,
        html: opts.html || opts.text,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);

      logger.info(
        {
          messageId: info.messageId,
          to: opts.to,
          previewUrl: previewUrl || undefined,
        },
        'Email successfully dispatched to SMTP server'
      );

      return {
        messageId: info.messageId,
        response: info.response,
        previewUrl: previewUrl || false,
        accepted: (info.accepted as string[]) || [opts.to],
        rejected: (info.rejected as string[]) || [],
      };
    } catch (error) {
      logger.error({ err: error, to: opts.to }, 'SMTP sending failed');
      throw error;
    }
  }
}

export const etherealSmtpService = new EtherealSmtpService();
