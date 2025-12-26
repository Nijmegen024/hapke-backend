import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { MailService } from './mail/mail.service';

@Controller('debug')
export class DebugController {
  constructor(private readonly mail: MailService) {}

  @Get('smtp')
  async smtp(@Headers('x-debug-secret') secret?: string) {
    const allowed =
      (process.env.NODE_ENV ?? '').toLowerCase() !== 'production' ||
      (process.env.DEBUG_SECRET && secret === process.env.DEBUG_SECRET);
    if (!allowed) {
      throw new UnauthorizedException('Debug endpoint niet toegestaan');
    }
    const result = await this.mail.verify();
    return result;
  }
}

