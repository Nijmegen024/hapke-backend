import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    // TODO: zet de volgende env vars in Render:
    // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // TODO: indien nodig, zet SMTP_SECURE=true
        auth: { user, pass },
      })
    } else {
      this.logger.warn('SMTP niet geconfigureerd; emails worden niet verstuurd.')
    }
  }

  async sendMail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.transporter) {
      const error = 'SMTP niet geconfigureerd';
      this.logger.warn(`${error}; mail niet verzonden naar ${to}`);
      return { ok: false, error };
    }
    const from = process.env.SMTP_FROM ?? 'no-reply@example.com';
    try {
      await this.transporter.sendMail({ from, to, subject, text, html });
      return { ok: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.logger.error(`Kon mail niet versturen naar ${to}: ${error}`);
      return { ok: false, error };
    }
  }

  async sendLoginCode(email: string, code: string) {
    await this.sendMail(
      email,
      'Je Hapke verificatiecode',
      `Jouw code is: ${code} (geldig 10 minuten)`,
    )
  }

  async verify() {
    if (!this.transporter) {
      return { ok: false, message: 'SMTP niet geconfigureerd' }
    }
    try {
      await this.transporter.verify()
      return { ok: true, message: 'SMTP OK' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, message }
    }
  }

  configSummary() {
    if (!this.transporter) {
      return 'SMTP niet geconfigureerd'
    }
    const opts = this.transporter.options as Record<string, unknown>
    const host = opts.host ?? 'host?'
    const port = opts.port ?? 'port?'
    const secure = opts.secure == null ? '' : opts.secure ? ' (secure)' : ''
    return `${host}:${port}${secure}`
  }
}
