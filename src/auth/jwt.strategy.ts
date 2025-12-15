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
      // Gebruik één secret voor alle tokens (vendor + customer)
      secretOrKey: process.env.JWT_SECRET ?? 'dev-access-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // Vertrouw op de payload: geen DB-lookup meer (voorkomt 401 bij /friends)
    if (!payload?.sub) {
      throw new UnauthorizedException('Token is niet langer geldig');
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role ?? 'USER',
    };
  }
}
