import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-access-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // Laat zowel gebruikers als vendors toe; geen harde rol-check
    const account =
      (await this.prisma.user.findUnique({ where: { id: payload.sub } })) ||
      (await this.prisma.vendor.findUnique({ where: { id: payload.sub } }));

    if (!account) {
      throw new UnauthorizedException('Token is niet langer geldig');
    }

    return {
      id: account.id,
      email: (account as any).email,
      role: payload.role ?? (account as any).role ?? 'USER',
    };
  }
}
