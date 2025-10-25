import { Injectable } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: Transporter;
  private defaultFrom: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const secureEnv = (process.env.SMTP_SECURE || '').toString().toLowerCase();
    const secure = secureEnv ? secureEnv === 'true' : false;

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    const fromEnv = (
      process.env.FROM_EMAIL ||
      process.env.SMTP_FROM ||
      process.env.MAIL_FROM ||
      ''
    ).trim();
    this.defaultFrom = fromEnv || 'Hapke <noreply@hapke.app>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendMail(to: string, subject: string, text: string) {
    try {
      const info = (await this.transporter.sendMail({
        from: this.defaultFrom,
        to,
        subject,
        text,
      })) as unknown;
      const messageId = extractMessageId(info);

      console.log(
        `Mail verstuurd naar ${to} (onderwerp: ${subject}, id: ${messageId})`,
      );
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `Mail verzenden mislukt naar ${to} (onderwerp: ${subject}): ${message}`,
      );
      return { ok: false, error: message };
    }
  }

  async verify() {
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  configSummary() {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secureEnv = (process.env.SMTP_SECURE || '').toString().toLowerCase();
    const secure = secureEnv ? secureEnv === 'true' : false;
    const host = process.env.SMTP_HOST || '';
    return {
      host,
      port,
      secure,
      from: this.defaultFrom,
    };
  }
}

const extractMessageId = (info: unknown) =>
  typeof info === 'object' &&
  info !== null &&
  'messageId' in info &&
  typeof (info as { messageId?: unknown }).messageId === 'string'
    ? (info as { messageId: string }).messageId
    : 'n/a';
