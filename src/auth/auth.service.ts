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
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshCookieName = 'refresh_token';
  private readonly refreshCookiePath = '/auth/refresh';
  // Gebruik één secret voor alle tokens
  private readonly accessSecret = process.env.JWT_SECRET ?? 'dev-access-secret';
  private readonly refreshTtl =
    process.env.JWT_REFRESH_TTL ?? process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';
  private readonly accessTtlSeconds = this.resolveAccessTtlSeconds(
    process.env.JWT_ACCESS_TTL ?? process.env.JWT_EXPIRES_IN,
  );
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
  private readonly verificationUrlBase = this.resolveVerificationBase(
    process.env.VERIFICATION_URL_BASE,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async requestEmailCode(emailRaw: string) {
    const email = this.normalizeEmail(emailRaw);
    this.ensureValidEmail(email);

    const latest = await this.prisma.loginCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() <
        this.getRateLimitMs(process.env.LOGIN_CODE_RATE_LIMIT_MS ?? '60000')
    ) {
      throw new BadRequestException('Wacht even en probeer opnieuw');
    }

    const code = this.generateNumericCode(6);
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.loginCode.deleteMany({ where: { email } }),
      this.prisma.loginCode.create({
        data: { email, codeHash, expiresAt },
      }),
    ]);

    await this.mailService.sendLoginCode(email, code);

    return { ok: true, expiresAt };
  }

  async resendEmailCode(emailRaw: string) {
    // Zelfde flow als request, maar laat rate-limit intact
    return this.requestEmailCode(emailRaw);
  }

  async verifyEmailCode(emailRaw: string, codeRaw: string) {
    const email = this.normalizeEmail(emailRaw);
    const code = (codeRaw ?? '').trim();
    this.ensureValidEmail(email);
    if (code.length < 4) {
      throw new UnauthorizedException('Code ongeldig');
    }

    const record = await this.prisma.loginCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new UnauthorizedException('Code ongeldig');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      await this.prisma.loginCode.deleteMany({ where: { email } });
      throw new UnauthorizedException('Code verlopen');
    }
    if (record.attempts >= 5) {
      await this.prisma.loginCode.deleteMany({ where: { email } });
      throw new UnauthorizedException('Te veel pogingen, vraag een nieuwe code aan');
    }

    const hashed = this.hashCode(code);
    if (hashed !== record.codeHash) {
      await this.prisma.loginCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Code ongeldig');
    }

    await this.prisma.loginCode.deleteMany({ where: { email } });

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const randomPassword = randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          isVerified: true,
        },
      });
    }

    const tokens = await this.generateTokenPair(user);
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashRefreshToken(tokens.refreshToken),
          expiresAt: tokens.refreshExpiresAt,
        },
      }),
    ]);

    return { accessToken: tokens.accessToken, user: this.mapUser(user) };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('E-mailadres is al geregistreerd');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const verificationToken = this.generateVerificationToken();
    const verificationDisabled =
      (process.env.DISABLE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        verificationToken: verificationDisabled ? null : verificationToken,
        isVerified: verificationDisabled,
      },
    });

    if (!verificationDisabled) {
      await this.sendVerificationEmail(user, verificationToken);
    }

    return {
      user: this.mapUser(user),
      requiresVerification: !verificationDisabled,
    };
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

      const verificationDisabled =
        (process.env.DISABLE_EMAIL_VERIFICATION || '').toLowerCase() ===
        'true';

      if (!verificationDisabled && !user.isVerified) {
        this.logger.warn(`Login geweigerd voor ${email}: account niet actief`);
        throw new UnauthorizedException('Account nog niet geactiveerd');
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

  async verifyEmailToken(token: string) {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new BadRequestException('Ongeldig verificatietoken');
    }

    const user = await this.prisma.user.findUnique({
      where: { verificationToken: trimmed },
    });

    if (!user) {
      throw new BadRequestException(
        'Dit verificatietoken is ongeldig of is al gebruikt',
      );
    }

    if (user.isVerified) {
      if (user.verificationToken) {
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: { verificationToken: null },
        });
        return { user: this.mapUser(updated), alreadyVerified: true };
      }
      return { user: this.mapUser(user), alreadyVerified: true };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    return { user: this.mapUser(updated), alreadyVerified: false };
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

  async resendVerification(emailRaw: string) {
    const email = emailRaw.toLowerCase().trim();
    const verificationDisabled =
      (process.env.DISABLE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';
    if (verificationDisabled) {
      throw new BadRequestException(
        'E-mailverificatie staat uit; account wordt direct geactiveerd.',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Gebruiker niet gevonden');
    }
    if (user.isVerified) {
      throw new BadRequestException('Account is al geactiveerd');
    }
    const newToken = this.generateVerificationToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: newToken },
    });
    await this.sendVerificationEmail(user, newToken);
    return { message: 'Verificatiemail opnieuw verstuurd' };
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
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role ?? 'CUSTOMER',
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtlSeconds,
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
      isVerified: user.isVerified,
      role: user.role,
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

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async sendVerificationEmail(user: User, token: string) {
    const link = `${this.verificationUrlBase}/${token}`;
    const text = [
      'Welkom bij Hapke!',
      '',
      'Klik op de onderstaande link om je account te activeren:',
      link,
      '',
      'Als je deze aanvraag niet hebt gedaan, kun je deze e-mail negeren.',
    ].join('\n');
    const html = [
      '<p>Welkom bij Hapke! Klik hieronder om je account te activeren.</p>',
      `<p><a href="${link}" style="display:inline-block;padding:12px 24px;background-color:#E53935;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Activeer je account</a></p>`,
      '<p>Werkt de knop niet? Kopieer dan deze link in je browser:</p>',
      `<p><a href="${link}">${link}</a></p>`,
    ].join('');

    try {
      const result = await this.mailService.sendMail(
        user.email,
        'Activeer je Hapke-account',
        text,
        html,
      );
      if (!result.ok) {
        this.logger.warn(
          `Verificatie-mail verzenden mislukt voor ${user.email}: ${result.error}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Verificatie-mail verzenden gooide een fout voor ${user.email}: ${message}`,
      );
    }
  }

  private resolveVerificationBase(value: string | undefined) {
    const fallback = 'https://hapke-frontend.onrender.com/verify';
    const base = (value ?? fallback).trim() || fallback;
    return base.replace(/\/+$/, '');
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

  private resolveAccessTtlSeconds(envValue?: string) {
    if (envValue) {
      const asNumber = Number(envValue);
      if (!Number.isNaN(asNumber) && asNumber > 0) {
        return asNumber;
      }
    }
    // default 7 dagen
    return 60 * 60 * 24 * 7;
  }

  private normalizeEmail(value: string) {
    return (value ?? '').toLowerCase().trim();
  }

  private ensureValidEmail(email: string) {
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!emailOk) {
      throw new BadRequestException('Ongeldig e-mailadres');
    }
  }

  private generateNumericCode(length: number) {
    const max = 10 ** length;
    const num = Math.floor(Math.random() * max)
      .toString()
      .padStart(length, '0');
    return num;
  }

  private hashCode(code: string) {
    return createHash('sha256').update(code.trim()).digest('hex');
  }

  private getRateLimitMs(value: string) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    return 60000;
  }
}
