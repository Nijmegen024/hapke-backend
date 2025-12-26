import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    const host = process.env.SMTP_HOST?.trim()
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS
    const from = process.env.SMTP_FROM?.trim()
    const secureFlag = (process.env.SMTP_SECURE ?? '').toLowerCase() === 'true'

    if (host && port && user && pass) {
      const secure = secureFlag || port === 465
      this.logger.log(
        `SMTP config: host=${host} port=${port} secure=${secure} user=${user} from=${from ?? 'n/a'}`,
      )
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        requireTLS: !secure && port === 587 ? true : undefined,
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
      const info = await this.transporter.sendMail({ from, to, subject, text, html });
      this.logger.log(`Mail verstuurd naar ${to} (messageId=${info.messageId ?? 'n/a'})`);
      return { ok: true };
    } catch (e: any) {
      const error =
        e instanceof Error ? e.message : typeof e === 'object' ? JSON.stringify(e) : String(e);
      this.logger.error(
        `Kon mail niet versturen naar ${to}: ${error} code=${e?.code ?? ''} errno=${e?.errno ?? ''} response=${e?.response ?? ''} command=${e?.command ?? ''}`,
      );
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
      const res = await this.transporter.verify()
      return { ok: true, message: typeof res === 'string' ? res : 'SMTP OK' }
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        message,
        code: e?.code,
        errno: e?.errno,
        command: e?.command,
        response: e?.response,
      }
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
