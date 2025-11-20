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
    const staticRestaurants = [
      {
        id: 'r1',
        name: 'Pizzeria Napoli',
        cuisine: 'Italiaans • Pizza',
        rating: 4.6,
        minOrder: 15,
        deliveryCost: 0,
      },
      {
        id: 'r2',
        name: 'Sushi Nijmeegs',
        cuisine: 'Japans • Sushi',
        rating: 4.4,
        minOrder: 20,
        deliveryCost: 1.5,
      },
    ];

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

    return [...staticRestaurants, ...vendorRestaurants];
  }

  @Get(':id/menu')
  async menu(@Param('id') id: string) {
    if (id === 'r1') {
      return [
        {
          id: 'm1',
          title: 'Margherita',
          description: 'Tomaat, mozzarella, basilicum',
          price: 9.5,
        },
        {
          id: 'm2',
          title: 'Quattro Formaggi',
          description: 'Vier kazen, romig & rijk',
          price: 12.5,
        },
        {
          id: 'm3',
          title: 'Tiramisu',
          description: 'Huisgemaakt dessert',
          price: 6.5,
        },
        {
          id: 'm15',
          title: 'Pizza Pepperoni',
          description: 'Pepperoni, mozzarella, tomaat',
          price: 11.5,
        },
        {
          id: 'm16',
          title: 'Lasagne',
          description: 'Laagjes pasta, gehakt, bechamelsaus',
          price: 12.0,
        },
      ];
    }
    if (id === 'r2') {
      return [
        {
          id: 'm4',
          title: 'Salmon Maki (8st)',
          description: 'Zalm, nori, rijst',
          price: 8.95,
        },
        {
          id: 'm5',
          title: 'Spicy Tuna Roll',
          description: 'Tonijn met pit',
          price: 11.95,
        },
        {
          id: 'm6',
          title: 'Gyoza (6st)',
          description: 'Kip & groente',
          price: 6.75,
        },
        {
          id: 'm17',
          title: 'California Roll',
          description: 'Krab, avocado, komkommer',
          price: 9.95,
        },
        {
          id: 'm18',
          title: 'Ebi Tempura',
          description: 'Gefrituurde garnaal, saus',
          price: 10.95,
        },
      ];
    }
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
      title: item.name,
      description: item.description ?? '',
      price: this.decimalToNumber(item.price) ?? 0,
      priceCents: this.priceToCents(item.price),
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
}
