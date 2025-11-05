import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.authService.attachRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.authService.extractRefreshToken(req);
    const result = await this.authService.refreshTokens(refreshToken);
    this.authService.attachRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = this.authService.extractRefreshToken(req);
    await this.authService.logout(refreshToken);
    this.authService.clearRefreshCookie(res);
    return;
  }

  @Post('verify/:token')
  async verify(@Param('token') token: string) {
    const result = await this.authService.verifyEmailToken(token);
    return {
      message: result.alreadyVerified
        ? 'Account was al geactiveerd'
        : 'Je account is geactiveerd!',
      alreadyVerified: result.alreadyVerified,
      user: result.user,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: Request & { user?: { id?: string } }) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Geen gebruiker gevonden');
    }
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new UnauthorizedException('Gebruiker niet gevonden');
    }
    return { user };
  }
}
