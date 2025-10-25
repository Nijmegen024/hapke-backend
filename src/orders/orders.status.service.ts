import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

const MINUTE_MS = 60_000;
const PREPARING_AFTER_MS = 2 * MINUTE_MS;
const ON_THE_WAY_AFTER_MS = 10 * MINUTE_MS;
const DELIVERED_AFTER_MS = 25 * MINUTE_MS;

@Injectable()
export class OrdersStatusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersStatusService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      this.progress().catch((err) => {
        this.logger.error(`Failed to progress orders: ${err?.message || err}`);
      });
    }, MINUTE_MS);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async triggerNow() {
    await this.progress();
  }

  private async progress() {
    const now = new Date();

    await this.prisma.order.updateMany({
      where: {
        status: OrderStatus.RECEIVED,
        receivedAt: { lte: new Date(now.getTime() - PREPARING_AFTER_MS) },
      },
      data: {
        status: OrderStatus.PREPARING,
        preparingAt: now,
      },
    });

    await this.prisma.order.updateMany({
      where: {
        status: OrderStatus.PREPARING,
        receivedAt: { lte: new Date(now.getTime() - ON_THE_WAY_AFTER_MS) },
      },
      data: {
        status: OrderStatus.ON_THE_WAY,
        onTheWayAt: now,
      },
    });

    await this.prisma.order.updateMany({
      where: {
        status: OrderStatus.ON_THE_WAY,
        receivedAt: { lte: new Date(now.getTime() - DELIVERED_AFTER_MS) },
      },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: now,
      },
    });
  }
}
