import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import type { Request, Response } from 'express';

import type { Address, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshCookieName = 'refresh_token';
  private readonly refreshCookiePath = '/auth/refresh';
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET ??
    process.env.JWT_SECRET ??
    'dev-access-secret';
  private readonly refreshTtl =
    process.env.JWT_REFRESH_TTL ?? process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';
  private readonly accessTtl =
    process.env.JWT_ACCESS_TTL ?? process.env.JWT_EXPIRES_IN ?? '15m';
  private readonly refreshTtlMs = this.parseDurationToMs(
    this.refreshTtl,
    30 * 24 * 60 * 60 * 1000,
  );
  private readonly cookieDomain =
    process.env.COOKIE_DOMAIN?.trim() || undefined;
  private readonly cookieSecure =
    (process.env.COOKIE_SECURE ?? 'true').toLowerCase() !== 'false';
  private readonly cookieSameSite = this.resolveSameSite(
    process.env.COOKIE_SAME_SITE,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('E-mailadres is al geregistreerd');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    return { user: this.mapUser(user) };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        this.logger.warn(
          `Login mislukte voor ${email}: gebruiker niet gevonden`,
        );
        throw new UnauthorizedException('Ongeldige inlog');
      }

      const passwordMatch = await bcrypt.compare(
        dto.password,
        user.passwordHash,
      );
      if (!passwordMatch) {
        this.logger.warn(`Login mislukte voor ${email}: wachtwoord mismatch`);
        throw new UnauthorizedException('Ongeldige inlog');
      }

      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const tokens = await this.generateTokenPair(user);

      await this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashRefreshToken(tokens.refreshToken),
          expiresAt: tokens.refreshExpiresAt,
        },
      });

      return { ...tokens, user: this.mapUser(user) };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Login fout voor ${email}: ${message}`);
      throw new UnauthorizedException('Ongeldige inlog');
    }
  }

  async refreshTokens(rawToken: string | null) {
    if (!rawToken) {
      throw new UnauthorizedException('Geen refresh token gevonden');
    }
    const hashed = this.hashRefreshToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashed },
      include: { user: true },
    });
    if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token ongeldig');
    }

    const { user } = existing;
    const tokens = await this.generateTokenPair(user);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashRefreshToken(tokens.refreshToken),
          expiresAt: tokens.refreshExpiresAt,
        },
      });
    });

    return { ...tokens, user: this.mapUser(user) };
  }

  async logout(rawToken: string | null) {
    if (!rawToken) {
      return;
    }
    const hashed = this.hashRefreshToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashed, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!user) {
      return null;
    }
    return this.mapUser(user, user.addresses);
  }

  attachRefreshCookie(res: Response, token: string) {
    res.cookie(this.refreshCookieName, token, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      domain: this.cookieDomain,
      path: this.refreshCookiePath,
      maxAge: this.refreshTtlMs,
    });
  }

  clearRefreshCookie(res: Response) {
    res.cookie(this.refreshCookieName, '', {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      domain: this.cookieDomain,
      path: this.refreshCookiePath,
      maxAge: 0,
    });
  }

  extractRefreshToken(req: Request): string | null {
    const cookies = this.getCookies(req);
    const token = cookies?.[this.refreshCookieName];
    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  private async generateTokenPair(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private mapUser(user: User, addresses?: Address[]) {
    const base = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };

    if (addresses && addresses.length > 0) {
      return {
        ...base,
        addresses: addresses.map((address) => this.mapAddress(address)),
      };
    }

    return base;
  }

  private mapAddress(address: Address) {
    return {
      id: address.id,
      street: address.street,
      houseNumber: address.houseNumber,
      postalCode: address.postalCode,
      city: address.city,
      lat: address.lat,
      lng: address.lng,
      isPrimary: address.isPrimary,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationToMs(value: string, fallback: number): number {
    const trimmed = value.trim();
    const match = /^(\d+)([smhd])?$/i.exec(trimmed);
    if (!match) {
      return fallback;
    }
    const amount = Number(match[1]);
    const unit = (match[2] ?? 'm').toLowerCase();
    const multiplier =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 60 * 1000
          : unit === 'h'
            ? 60 * 60 * 1000
            : unit === 'd'
              ? 24 * 60 * 60 * 1000
              : 60 * 1000;
    return amount * multiplier;
  }

  private resolveSameSite(
    value: string | undefined,
  ): 'lax' | 'strict' | 'none' {
    const candidate = (value ?? 'lax').toLowerCase();
    if (candidate === 'strict' || candidate === 'none' || candidate === 'lax') {
      return candidate;
    }
    return 'lax';
  }

  private parseCookieHeader(header?: string | string[]) {
    if (!header) {
      return undefined;
    }
    const raw = Array.isArray(header) ? header.join(';') : header;
    return raw.split(';').reduce<Record<string, string>>((acc, pair) => {
      const [key, ...rest] = pair.trim().split('=');
      if (!key) {
        return acc;
      }
      const value = rest.join('=');
      acc[key] = value ? decodeURIComponent(value) : '';
      return acc;
    }, {});
  }

  private getCookies(req: Request): Record<string, string> | undefined {
    const candidate = (req as Request & { cookies?: unknown }).cookies;
    if (this.isStringRecord(candidate)) {
      return candidate;
    }
    return this.parseCookieHeader(req.headers?.cookie);
  }

  private isStringRecord(value: unknown): value is Record<string, string> {
    if (!value || typeof value !== 'object') {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every(
      (entry) => typeof entry === 'string',
    );
  }
}
