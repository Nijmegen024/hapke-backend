import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

import { UpdateProfileDto } from './dto/update-profile.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  async updateProfile(
    @Req() req: Request & { user?: { id?: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    const userId = this.requireUserId(req);
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('addresses')
  async create(
    @Req() req: Request & { user?: { id?: string } },
    @Body() dto: CreateAddressDto,
  ) {
    const userId = this.requireUserId(req);
    return this.usersService.createAddress(userId, dto);
  }

  @Get('addresses')
  async list(@Req() req: Request & { user?: { id?: string } }) {
    const userId = this.requireUserId(req);
    return this.usersService.listAddresses(userId);
  }

  @Patch('addresses/:id')
  async update(
    @Req() req: Request & { user?: { id?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const userId = this.requireUserId(req);
    return this.usersService.updateAddress(userId, id, dto);
  }

  @Delete('addresses/:id')
  @HttpCode(204)
  async remove(
    @Req() req: Request & { user?: { id?: string } },
    @Param('id') id: string,
  ) {
    const userId = this.requireUserId(req);
    await this.usersService.deleteAddress(userId, id);
  }

  @Patch('addresses/:id/primary')
  async setPrimary(
    @Req() req: Request & { user?: { id?: string } },
    @Param('id') id: string,
  ) {
    const userId = this.requireUserId(req);
    return this.usersService.setPrimaryAddress(userId, id);
  }

  private requireUserId(req: Request & { user?: { id?: string } }) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Geen gebruiker gevonden');
    }
    return userId;
  }
}
