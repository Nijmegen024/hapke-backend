import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

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

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        this.logger.warn(`Login mislukte voor ${email}: gebruiker niet gevonden`);
        throw new UnauthorizedException('Ongeldige inlog');
      }

      const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
      if (!passwordMatch) {
        this.logger.warn(`Login mislukte voor ${email}: wachtwoord mismatch`);
        throw new UnauthorizedException('Ongeldige inlog');
      }

      return this.buildAuthResponse(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Login fout voor ${email}: ${error?.message || error}`);
      throw new UnauthorizedException('Ongeldige inlog');
    }
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.mapUser(user) : null;
  }

  private mapUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  private async buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      user: this.mapUser(user),
      access_token: accessToken,
    };
  }
}
