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
    // debug
    // eslint-disable-next-line no-console
    console.log('JWT payload', payload);

    // probeer eerst gewone gebruiker
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (user) {
      return {
        id: user.id,
        email: user.email,
        role: payload.role ?? user.role,
      };
    }

    // fallback: vendor-token
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: payload.sub },
    });
    if (vendor) {
      return {
        id: vendor.id,
        email: vendor.email,
        role: payload.role ?? 'VENDOR',
      };
    }

    throw new UnauthorizedException('Token is niet langer geldig');
  }
}
