import { Injectable, Logger } from '@nestjs/common'
import { Resend } from 'resend'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private resend: Resend | null = null

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    if (apiKey) {
      this.resend = new Resend(apiKey)
      this.logger.log('Resend mail transport actief (HTTP API)')
    } else {
      this.logger.warn('RESEND_API_KEY ontbreekt; emails worden niet verstuurd.')
    }
  }

  async sendMail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.resend) {
      const error = 'Resend niet geconfigureerd';
      this.logger.warn(`${error}; mail niet verzonden naar ${to}`);
      return { ok: false, error };
    }
    const from = process.env.SMTP_FROM ?? 'no-reply@example.com';
    try {
      const result = await this.resend.emails.send({
        from,
        to,
        subject,
        text,
        html,
      });
      this.logger.log(`Mail verstuurd naar ${to} (id=${(result as any)?.id ?? 'n/a'})`);
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
    if (!this.resend) {
      return { ok: false, message: 'Resend niet geconfigureerd' }
    }
    return { ok: true, message: 'Resend HTTP actief' }
  }

  configSummary() {
    if (!this.resend) {
      return 'Resend niet geconfigureerd'
    }
    return 'Resend HTTP API'
  }
}
