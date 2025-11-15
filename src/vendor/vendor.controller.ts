import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { VendorService } from './vendor.service';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { LoginVendorDto } from './dto/login-vendor.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
} from './dto/menu-category.dto';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dto/menu-item.dto';

@Controller('vendor')
export class VendorController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendors: VendorService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterVendorDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const vendor = await this.vendors.register(dto);
    const token = await this.vendors.signToken(vendor);
    this.vendors.applyAuthCookie(res, token);
    return {
      message: 'Bedrijf aangemaakt',
      token,
      vendor: this.vendors.toSafeVendor(vendor),
    };
  }

  @Post('login')
  async login(
    @Body() dto: LoginVendorDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const vendor = await this.vendors.validateCredentials(dto);
    const token = await this.vendors.signToken(vendor);
    this.vendors.applyAuthCookie(res, token);
    return {
      message: 'Ingelogd',
      token,
      vendor: this.vendors.toSafeVendor(vendor),
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.vendors.clearAuthCookie(res);
  }

  @Get('me')
  async me(@Req() req: Request) {
    const vendor = await this.vendors.authenticateRequest(req);
    return { vendor: this.vendors.toSafeVendor(vendor) };
  }

  @Get('profile')
  async profile(@Req() req: Request) {
    const vendor = await this.vendors.authenticateRequest(req);
    return this.vendors.getVendorDashboard(vendor.id);
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    const vendor = await this.vendors.authenticateRequest(req);
    return this.vendors.updateVendorProfile(vendor.id, dto);
  }

  @Get('menu')
  async menu(@Req() req: Request) {
    const vendor = await this.vendors.authenticateRequest(req);
    const dashboard = await this.vendors.getVendorDashboard(vendor.id);
    return dashboard.menu;
  }

  @Post('menu/categories')
  async createCategory(
    @Req() req: Request,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    const vendor = await this.vendors.authenticateRequest(req);
    return this.vendors.createCategory(vendor.id, dto);
  }

  @Patch('menu/categories/:id')
  async updateCategory(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    const vendor = await this.vendors.authenticateRequest(req);
    return this.vendors.updateCategory(vendor.id, id, dto);
  }

  @Delete('menu/categories/:id')
  async deleteCategory(@Req() req: Request, @Param('id') id: string) {
    const vendor = await this.vendors.authenticateRequest(req);
    return this.vendors.deleteCategory(vendor.id, id);
  }

  @Post('menu/items')
  async createMenuItem(
    @Req() req: Request,
    @Body() dto: CreateMenuItemDto,
  ) {
    const vendor = await this.vendors.authenticateRequest(req);
    return this.vendors.createMenuItem(vendor.id, dto);
  }

  @Patch('menu/items/:id')
  async updateMenuItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    const vendor = await this.vendors.authenticateRequest(req);
    return this.vendors.updateMenuItem(vendor.id, id, dto);
  }

  @Delete('menu/items/:id')
  async deleteMenuItem(@Req() req: Request, @Param('id') id: string) {
    const vendor = await this.vendors.authenticateRequest(req);
    return this.vendors.deleteMenuItem(vendor.id, id);
  }

  @Get('orders')
  async getOrders(@Req() req: Request) {
    const vendor = await this.vendors.authenticateRequest(req);
    const orders = await this.prisma.order.findMany({
      where: { vendorId: vendor.id },
      include: { items: true },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });
    return orders;
  }

  @Patch('orders/:id/status')
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const vendor = await this.vendors.authenticateRequest(req);
    if (!status) {
      throw new HttpException(
        { result: 'blocked', reason: 'status_missing' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new HttpException(
        { result: 'blocked', reason: 'status_invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!order || order.vendorId !== vendor.id) {
      throw new HttpException(
        { result: 'blocked', reason: 'order_not_found' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const nextStatus = status as OrderStatus;

    const statusFlow = [
      OrderStatus.RECEIVED,
      OrderStatus.PREPARING,
      OrderStatus.ON_THE_WAY,
      OrderStatus.DELIVERED,
    ] as const;
    const currentIndex = statusFlow.indexOf(order.status);
    const allowedNext =
      currentIndex >= 0 ? (statusFlow[currentIndex + 1] ?? null) : null;

    if (nextStatus !== allowedNext) {
      throw new HttpException(
        { result: 'blocked', reason: 'transition_invalid' },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.order.update({
      where: { id },
      data: { status: nextStatus },
    });
    return { result: 'updated' };
  }
}
