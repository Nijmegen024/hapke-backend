import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  getAllRestaurants() {
    return this.prisma.vendor.findMany({
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getRestaurantById(id: string) {
    return this.prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
      },
    });
  }

  updateRestaurant(id: string, data: any) {
    return this.prisma.vendor.update({
      where: { id },
      data,
    });
  }

  getAllOrders(params: { restaurantId?: string; from?: Date; to?: Date }) {
    const { restaurantId, from, to } = params;
    return this.prisma.order.findMany({
      where: {
        vendorId: restaurantId || undefined,
        createdAt: {
          gte: from || undefined,
          lte: to || undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: true,
      },
    });
  }
}
