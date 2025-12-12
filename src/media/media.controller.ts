import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { MediaService } from './media.service';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('sign-upload')
  @UseGuards(AuthGuard('jwt'))
  async signUpload(
    @Req() req: Request,
    @Body() body: { fileName?: string },
  ) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    // Logging voor debug
    // console.log('auth header:', auth?.slice(0, 30));
    return this.media.signUpload(token, body?.fileName);
  }
}
