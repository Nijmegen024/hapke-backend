import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

function extractUserId(req: Request): string | null {
  const auth = req.headers?.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  const token = auth.substring('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET ?? 'dev-access-secret',
    );
    return decoded?.sub ?? decoded?.id ?? null;
  } catch (_) {
    return null;
  }
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return { message: 'Welcome to Hapke' };
  }

  // For tests: keep classic Nest starter contract
  getHello() {
    return this.appService.getHello();
  }
}

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const latParam = (req.query.lat as string | undefined)?.trim();
    const lngParam = (req.query.lng as string | undefined)?.trim();

    if (!latParam || !lngParam) {
      throw new BadRequestException(
        'Locatie ontbreekt. Geef lat en lng query parameters mee.',
      );
    }
    const userLat = Number(latParam);
    const userLng = Number(lngParam);
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      throw new BadRequestException('Ongeldige lat/lng opgegeven.');
    }

    const vendors = (await this.prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: { category: true },
        },
        menuCategories: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      },
    })) as any[];

    const vendorRestaurants = vendors
      .map((vendor) => {
        const radius = vendor.deliveryRadiusKm ?? 5;
        if (
          vendor.lat === null ||
          vendor.lat === undefined ||
          vendor.lng === null ||
          vendor.lng === undefined
        ) {
          return null;
        }
        const distanceKm = this.haversineKm(userLat, userLng, vendor.lat, vendor.lng);
        const withinRange = distanceKm <= radius;
        if (!withinRange) return null;
        return {
          id: vendor.id,
          name: vendor.name,
          cuisine:
            vendor.cuisine ??
            vendor.description ??
            'Beschrijving nog in te vullen',
          rating: vendor.isActive ? 4.5 : 0,
          minOrder: this.decimalToNumber(vendor.minOrder) ?? 20,
          deliveryCost: this.decimalToNumber(vendor.deliveryFee) ?? 0,
          city: vendor.city,
          category: vendor.category ?? 'Nieuw',
          eta: vendor.etaDisplay ?? '35–45 min',
          imageUrl:
            vendor.heroImageUrl ??
            vendor.logoImageUrl ??
            'https://images.unsplash.com/photo-1541542684-4abf21a55761?auto=format&fit=crop&w=1200&q=80',
          isActive: vendor.isActive,
          deliveryRadiusKm: radius,
          distanceKm: Number(distanceKm.toFixed(2)),
          categories: vendor.menuCategories.map((category) => ({
            id: category.id,
            name: category.name,
            description: category.description ?? '',
            position: category.position,
          })),
          menu: vendor.menuItems.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description ?? '',
            priceCents: this.priceToCents(item.price),
            categoryId: item.categoryId,
            categoryName: item.category?.name ?? undefined,
            imageUrl: item.imageUrl,
            isHighlighted: item.isHighlighted,
          })),
        };
      })
      .filter((v) => v !== null);

    return vendorRestaurants;
  }

  @Get(':id/menu')
  async menu(@Param('id') id: string) {
    const vendor = (await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: { category: true },
        },
      },
    })) as any;
    if (!vendor) {
      return [];
    }
    return vendor.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price: this.decimalToNumber(item.price) ?? 0,
      priceCents: this.priceToCents(item.price),
      imageUrl: item.imageUrl,
      isHighlighted: item.isHighlighted,
      categoryId: item.categoryId,
      categoryName: item.category?.name ?? undefined,
    }));
  }

  @Get(':id/videos')
  async videos(@Param('id') id: string, @Req() req: Request) {
    const userId = extractUserId(req);
    const videos = await this.prisma.video.findMany({
      where: { vendorId: id, isVisible: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        thumbUrl: true,
        vendorId: true,
        createdAt: true,
        _count: { select: { likes: true } },
        likes: userId
          ? { where: { userId }, select: { id: true } }
          : undefined,
      },
    });
    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      videoUrl: video.videoUrl,
      thumbUrl: video.thumbUrl,
      vendorId: video.vendorId,
      createdAt: video.createdAt,
      likesCount: video._count.likes,
      likedByMe: userId ? (video.likes as any[])?.length > 0 : false,
    }));
  }

  @Get(':id/categories')
  async categories(@Param('id') id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        menuCategories: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!vendor) {
      return [];
    }
    return vendor.menuCategories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description ?? '',
      position: category.position,
    }));
  }

  private decimalToNumber(
    value?: Prisma.Decimal | number | null,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    return Number(value);
  }

  private priceToCents(value?: Prisma.Decimal | number | null) {
    const euros = this.decimalToNumber(value) ?? 0;
    const cents = Math.round(euros * 100);
    return cents < 0 ? 0 : cents;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

@Controller('videos')
export class VideosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const userId = extractUserId(req);
    const videos = await this.prisma.video.findMany({
      where: { isVisible: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        thumbUrl: true,
        vendorId: true,
        createdAt: true,
        _count: { select: { likes: true } },
        likes: userId
          ? { where: { userId }, select: { id: true } }
          : undefined,
      },
    });
    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      videoUrl: video.videoUrl,
      thumbUrl: video.thumbUrl,
      vendorId: video.vendorId,
      createdAt: video.createdAt,
      likesCount: video._count.likes,
      likedByMe: userId ? (video.likes as any[])?.length > 0 : false,
    }));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/like')
  async like(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      return { likesCount: 0, likedByMe: false };
    }
    await this.prisma.videoLike.upsert({
      where: { videoId_userId: { videoId: id, userId } },
      create: { videoId: id, userId },
      update: {},
    });
    const likesCount = await this.prisma.videoLike.count({
      where: { videoId: id },
    });
    return { likesCount, likedByMe: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/like')
  async unlike(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      return { likesCount: 0, likedByMe: false };
    }
    await this.prisma.videoLike.deleteMany({
      where: { videoId: id, userId },
    });
    const likesCount = await this.prisma.videoLike.count({
      where: { videoId: id },
    });
    return { likesCount, likedByMe: false };
  }

  @Get(':id/comments')
  async listComments(@Param('id') id: string) {
    const comments = await this.prisma.videoComment.findMany({
      where: { videoId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt,
      user: {
        id: c.user?.id,
        name: c.user?.name ?? c.user?.email ?? 'Onbekend',
        email: c.user?.email,
      },
    }));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/comments')
  async addComment(
    @Param('id') id: string,
    @Body('text') text: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Geen gebruiker');
    }
    const trimmed = (text ?? '').toString().trim();
    if (!trimmed) {
      throw new BadRequestException('Tekst is verplicht');
    }
    const comment = await this.prisma.videoComment.create({
      data: { videoId: id, userId, text: trimmed },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      user: {
        id: comment.user?.id,
        name: comment.user?.name ?? comment.user?.email ?? 'Onbekend',
        email: comment.user?.email,
      },
    };
  }
}
