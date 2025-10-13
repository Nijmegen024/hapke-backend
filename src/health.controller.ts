import { Controller, Get, Optional } from '@nestjs/common';
import { MailService } from './mail/mail.service';

@Controller('health')
export class HealthController {
  constructor(@Optional() private readonly mail?: MailService) {}

  @Get('mail')
  async mailHealth() {
    if (!this.mail) {
      return { ok: false, error: 'MailService not available', ts: new Date().toISOString() };
    }
    const verify = await this.mail.verify();
    return {
      ...verify,
      transport: this.mail.configSummary(),
      ts: new Date().toISOString(),
    };
  }
}

