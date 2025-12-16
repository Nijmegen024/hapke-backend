import { Controller, Get, Param } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

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
  async list() {
    const vendors = await this.prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    const vendorRestaurants = vendors.map((vendor) => ({
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
      menu: vendor.menuItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        priceCents: this.priceToCents(item.price),
        categoryId: item.categoryId,
        imageUrl: item.imageUrl,
        isHighlighted: item.isHighlighted,
      })),
    }));

    return vendorRestaurants;
  }

  @Get(':id/menu')
  async menu(@Param('id') id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
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
    }));
  }

  @Get(':id/videos')
  async videos(@Param('id') id: string) {
    return this.prisma.video.findMany({
      where: { vendorId: id, isVisible: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        thumbUrl: true,
        createdAt: true,
      },
    });
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
}
