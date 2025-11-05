import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';

import type { Vendor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { LoginVendorDto } from './dto/login-vendor.dto';

type VendorTokenPayload = {
  sub: string;
  role: 'vendor';
  email: string;
};

type SafeVendor = Omit<Vendor, 'passwordHash'>;

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);
  private readonly cookieName = 'vendor_token';
  private readonly cookieOptions = this.createCookieOptions();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterVendorDto) {
    const email = dto.email.toLowerCase().trim();
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Bedrijfsnaam is verplicht');
    }

    const existing = await this.prisma.vendor.findUnique({
      where: { email },
    });
    if (existing) {
      throw new BadRequestException('E-mailadres is al geregistreerd');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const vendor = await this.prisma.vendor.create({
      data: {
        email,
        passwordHash,
        name,
        contactName: dto.contactName?.trim() || null,
        phone: dto.phone?.trim() || null,
        street: dto.street?.trim() || null,
        postalCode: dto.postalCode?.trim() || null,
        city: dto.city?.trim() || null,
        description: dto.description?.trim() || null,
        isActive: false,
      },
    });

    return vendor;
  }

  async validateCredentials(dto: LoginVendorDto) {
    const email = dto.email.toLowerCase().trim();
    const password = dto.password.trim();

    const vendor = await this.prisma.vendor.findUnique({
      where: { email },
    });
    if (!vendor) {
      throw new UnauthorizedException('Ongeldige inloggegevens');
    }

    const digest = vendor.passwordHash ?? '';
    const isHashed = digest.startsWith('$2');
    const isMatch = isHashed
      ? await bcrypt.compare(password, digest)
      : digest === password;

    if (!isMatch) {
      throw new UnauthorizedException('Ongeldige inloggegevens');
    }

    if (!isHashed) {
      try {
        const upgradedHash = await bcrypt.hash(password, 12);
        await this.prisma.vendor.update({
          where: { id: vendor.id },
          data: { passwordHash: upgradedHash },
        });
        vendor.passwordHash = upgradedHash;
      } catch (error) {
        this.logger.warn(
          `Kon wachtwoord voor vendor ${vendor.email} niet upgraden: ${error}`,
        );
      }
    }

    return vendor;
  }

  async signToken(vendor: Vendor) {
    const payload: VendorTokenPayload = {
      sub: vendor.id,
      email: vendor.email,
      role: 'vendor',
    };
    return this.jwt.signAsync(payload);
  }

  async verifyToken(token: string): Promise<VendorTokenPayload> {
    try {
      return await this.jwt.verifyAsync<VendorTokenPayload>(token);
    } catch (error) {
      this.logger.warn(`Vendor token ongeldig: ${error}`);
      throw new UnauthorizedException('Ongeldige sessie');
    }
  }

  async authenticateRequest(req: Request) {
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Geen vendor sessie gevonden');
    }
    const payload = await this.verifyToken(token);
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: payload.sub },
    });
    if (!vendor) {
      throw new UnauthorizedException('Vendor niet gevonden');
    }
    return vendor;
  }

  applyAuthCookie(res: Response, token: string) {
    res.cookie(this.cookieName, token, this.cookieOptions);
  }

  clearAuthCookie(res: Response) {
    res.cookie(this.cookieName, '', { ...this.cookieOptions, maxAge: 0 });
  }

  toSafeVendor(vendor: Vendor): SafeVendor {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = vendor;
    return rest;
  }

  private extractToken(req: Request): string | null {
    const auth = req.get('authorization');
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim() || null;
    }
    const cookies = (req as Request & { cookies?: unknown }).cookies;
    if (cookies && typeof cookies === 'object') {
      const token = (cookies as Record<string, unknown>)[this.cookieName];
      if (typeof token === 'string' && token.trim().length > 0) {
        return token.trim();
      }
    }
    return null;
  }

  private createCookieOptions() {
    const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || undefined;
    const cookieSecure =
      (process.env.COOKIE_SECURE ?? 'true').toLowerCase() !== 'false';
    const cookieSameSite = this.resolveSameSite(
      process.env.COOKIE_SAME_SITE,
    );
    return {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: cookieDomain,
      path: '/vendor',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    } as const;
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
}
