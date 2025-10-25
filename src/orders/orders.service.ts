import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { normalizeItems } from '../pricing';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersStatusService } from './orders.status.service';
import { MailService } from '../mail/mail.service';

const TOTAL_DELIVERY_MINUTES = 25;

interface StepInfo {
  name: OrderStatus;
  at: Date | null;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly statusService: OrdersStatusService,
    @Optional() private readonly mail?: MailService,
  ) {}

  async createOrder(userId: string | undefined, dto: CreateOrderDto) {
    if (!userId) {
      throw new BadRequestException('Gebruiker niet bekend');
    }

    const normalized = normalizeItems(dto.items);
    const paymentId = dto.paymentId?.toString().trim();
    if (!paymentId) {
      throw new BadRequestException('paymentId is verplicht');
    }

    const total = normalized.reduce((sum, item) => sum + item.price * item.qty, 0);
    await this.payments.ensurePaid(paymentId, total);

    const orderNumber = `ORD-${Date.now()}`;
    const receivedAt = new Date();

    const demoVendorId = (process.env.DEMO_VENDOR_ID || '').trim();
    const demoRestaurantId = (process.env.DEMO_RESTAURANT_ID || '').trim();
    const restaurantId = dto.restaurantId ? dto.restaurantId.toString().trim() : '';
    const attachDemoVendor = !!(restaurantId && demoRestaurantId && demoVendorId && restaurantId === demoRestaurantId);

    const vendorId = (process.env.DEMO_VENDOR_ID || '').trim();

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        paymentId,
        total: new Prisma.Decimal(total.toFixed(2)),
        status: OrderStatus.RECEIVED,
        receivedAt,
        ...(attachDemoVendor ? { vendorId: demoVendorId } : {}),
        items: {
          create: normalized.map(item => ({
            itemId: item.id,
            name: item.name,
            qty: item.qty,
            price: new Prisma.Decimal(item.price.toFixed(2)),
          })),
        },
      },
      include: { items: true },
    });

    await this.statusService.triggerNow();

    this.sendConfirmationMail(order, normalized, total, dto.email).catch(err => {
      this.logger.warn(`Order ${order.orderNumber}: mail verzenden mislukt - ${err?.message || err}`);
    });

    return {
      orderId: order.orderNumber,
      status: order.status,
      total,
      createdAt: order.createdAt.toISOString(),
      etaMinutes: this.calculateEta(order),
      items: order.items.map(item => ({
        id: item.itemId,
        name: item.name,
        qty: item.qty,
        price: Number(item.price),
      })),
      steps: this.mapSteps(order).map(step => ({
        name: step.name,
        at: step.at ? step.at.toISOString() : null,
      })),
    };
  }

  async getOrderDetail(orderNumber: string, userId: string | undefined) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Bestelling niet gevonden');
    }

    return {
      orderId: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      etaMinutes: this.calculateEta(order),
      items: order.items.map(item => ({
        id: item.itemId,
        name: item.name,
        qty: item.qty,
        price: Number(item.price),
      })),
      steps: this.mapSteps(order).map(step => ({
        name: step.name,
        at: step.at ? step.at.toISOString() : null,
      })),
    };
  }

  async getOrderStatus(orderNumber: string, userId: string | undefined) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
    });
    if (!order) {
      throw new NotFoundException('Bestelling niet gevonden');
    }
    return {
      orderId: order.orderNumber,
      status: order.status,
      etaMinutes: this.calculateEta(order),
      steps: this.mapSteps(order).map(step => ({
        name: step.name,
        at: step.at ? step.at.toISOString() : null,
      })),
    };
  }

  private calculateEta(order: { receivedAt: Date; deliveredAt: Date | null }): number {
    if (order.deliveredAt) {
      return 0;
    }
    const diffMinutes = (Date.now() - order.receivedAt.getTime()) / 60000;
    const remaining = Math.ceil(TOTAL_DELIVERY_MINUTES - diffMinutes);
    return remaining > 0 ? remaining : 0;
  }

  private mapSteps(order: {
    receivedAt: Date;
    preparingAt: Date | null;
    onTheWayAt: Date | null;
    deliveredAt: Date | null;
    status: OrderStatus;
  }): StepInfo[] {
    return [
      { name: OrderStatus.RECEIVED, at: order.receivedAt },
      { name: OrderStatus.PREPARING, at: order.preparingAt ?? null },
      { name: OrderStatus.ON_THE_WAY, at: order.onTheWayAt ?? null },
      { name: OrderStatus.DELIVERED, at: order.deliveredAt ?? null },
    ];
  }

  private async sendConfirmationMail(
    order: { orderNumber: string },
    items: ReturnType<typeof normalizeItems>,
    total: number,
    email?: string,
  ) {
    if (!this.mail) {
      return;
    }

    const toAddress =
      email ||
      (process.env.SMTP_TO || process.env.MAIL_TO_TEST || '').toString().trim() ||
      'dev@hapke.local';

    const lines = items
      .map(it => `• ${it.name} x${it.qty}  (€${(it.price * it.qty).toFixed(2)})`)
      .join('\n');
    const text = [
      'Bedankt voor je bestelling!',
      '',
      `Order: ${order.orderNumber}`,
      `Totaal: €${total.toFixed(2)}`,
      '',
      'Items:',
      lines,
      '',
      '— Team Hapke',
    ].join('\n');

    await this.mail.sendMail(toAddress, `Hapke bestelling ${order.orderNumber}`, text);
  }
}
