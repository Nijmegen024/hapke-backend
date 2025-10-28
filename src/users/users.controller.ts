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

@UseGuards(AuthGuard('jwt'))
@Controller('users/addresses')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(
    @Req() req: Request & { user?: { id?: string } },
    @Body() dto: CreateAddressDto,
  ) {
    const userId = this.requireUserId(req);
    return this.usersService.createAddress(userId, dto);
  }

  @Get()
  async list(@Req() req: Request & { user?: { id?: string } }) {
    const userId = this.requireUserId(req);
    return this.usersService.listAddresses(userId);
  }

  @Patch(':id')
  async update(
    @Req() req: Request & { user?: { id?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const userId = this.requireUserId(req);
    return this.usersService.updateAddress(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() req: Request & { user?: { id?: string } },
    @Param('id') id: string,
  ) {
    const userId = this.requireUserId(req);
    await this.usersService.deleteAddress(userId, id);
  }

  @Patch(':id/primary')
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
