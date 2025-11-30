import { Body, Controller, Post, Req } from '@nestjs/common';
import { MediaService } from './media.service';
import type { Request } from 'express';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('sign-upload')
  async signUpload(
    @Req() req: Request,
    @Body() body: { fileName?: string },
  ) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    return this.media.signUpload(token, body?.fileName);
  }
}
