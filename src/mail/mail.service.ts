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

    const fromEnv =
      (process.env.FROM_EMAIL || process.env.SMTP_FROM || process.env.MAIL_FROM || '').trim();
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
      const info = await this.transporter.sendMail({ from: this.defaultFrom, to, subject, text });
      // eslint-disable-next-line no-console
      console.log(`Mail verstuurd naar ${to} (onderwerp: ${subject}, id: ${info.messageId || 'n/a'})`);
      return { ok: true };
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`Mail verzenden mislukt naar ${to} (onderwerp: ${subject}): ${err?.message || err}`);
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async verify() {
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
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
