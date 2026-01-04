import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
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

    const paymentId = dto.paymentId?.toString().trim();
    if (!paymentId) {
      throw new BadRequestException('paymentId is verplicht');
    }

    const orderNumber = `ORD-${Date.now()}`;
    const receivedAt = new Date();

    const requestedVendorId = dto.restaurantId?.trim();
    let vendorId =
      requestedVendorId && requestedVendorId.length > 0
        ? requestedVendorId
        : undefined;
    if (!vendorId) {
      const fallback = (process.env.DEMO_VENDOR_ID || '').trim();
      vendorId = fallback.length > 0 ? fallback : undefined;
    }
    if (!vendorId) {
      this.logger.error(
        'Geen vendorId opgegeven en DEMO_VENDOR_ID ontbreekt.',
      );
      throw new InternalServerErrorException('Vendor configuratie ontbreekt');
    }

    const vendorExists = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendorExists) {
      throw new BadRequestException('Restaurant niet gevonden');
    }

    const normalized = normalizeItems(dto.items);
    const enriched = await this.fillNamesAndPrices(normalized, vendorId);

    const total = enriched.reduce((sum, item) => sum + item.price * item.qty, 0);
    await this.payments.ensurePaid(paymentId, total);

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        paymentId,
        total: new Prisma.Decimal(total.toFixed(2)),
        status: OrderStatus.RECEIVED,
        receivedAt,
        vendorId,
        items: {
          // cast naar any omdat Prisma client mogelijk nog oude velden heeft gegenereerd
          create: enriched.map((item) => ({
            menuItemId: item.id,
            productName: item.name,
            qty: item.qty,
            unitPrice: new Prisma.Decimal(item.price.toFixed(2)),
          })) as any,
        },
      },
      include: { items: true },
    });

    await this.statusService.triggerNow();

    this.sendConfirmationMail(order, normalized, total, dto.email).catch(
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Order ${order.orderNumber}: mail verzenden mislukt - ${message}`,
        );
      },
    );

    return {
      orderId: order.orderNumber,
      status: order.status,
      total,
      createdAt: order.createdAt.toISOString(),
      etaMinutes: this.calculateEta(order),
      items: (order.items as any[]).map((item: any) => ({
        id: item.menuItemId ?? item.itemId ?? undefined,
        productName: item.productName ?? item.name ?? '',
        name: item.productName ?? item.name ?? '',
        qty: item.qty,
        unitPrice: item.unitPrice
          ? Number(item.unitPrice)
          : item.price
            ? Number(item.price)
            : undefined,
      })),
      steps: this.mapSteps(order).map((step) => ({
        name: step.name,
        at: step.at ? step.at.toISOString() : null,
      })),
    };
  }

  private async fillNamesAndPrices(
    items: ReturnType<typeof normalizeItems>,
    vendorId: string,
  ) {
    const ids = Array.from(new Set(items.map((i) => i.id)));
    const menuItems = await this.prisma.vendorMenuItem.findMany({
      where: { vendorId, id: { in: ids } },
      select: { id: true, name: true, price: true },
    });
    const byId = new Map(menuItems.map((m) => [m.id, m]));

    return items.map((item) => {
      const menu = byId.get(item.id);
      const name =
        (item.name && item.name.trim() && item.name !== item.id
          ? item.name
          : menu?.name) ?? item.id;
      const price =
        item.price && item.price > 0
          ? item.price
          : menu?.price
            ? Number(menu.price)
            : 0;
      return { ...item, name, price };
    });
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
      items: (order.items as any[]).map((item: any) => ({
        id: item.menuItemId ?? item.itemId ?? undefined,
        productName: item.productName ?? item.name ?? '',
        name: item.productName ?? item.name ?? '',
        qty: item.qty,
        unitPrice: item.unitPrice
          ? Number(item.unitPrice)
          : item.price
            ? Number(item.price)
            : undefined,
      })),
      steps: this.mapSteps(order).map((step) => ({
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
      steps: this.mapSteps(order).map((step) => ({
        name: step.name,
        at: step.at ? step.at.toISOString() : null,
      })),
    };
  }

  async listUserOrders(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException('Gebruiker niet bekend');
    }
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return (orders as any).map((order: any) => ({
      orderId: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      etaMinutes: this.calculateEta(order),
      items: order.items.map((item) => ({
        id: item.itemId,
        name: item.productName ?? item.name,
        productName: item.productName ?? item.name,
        qty: item.qty,
        price: Number(item.price),
      })),
      steps: this.mapSteps(order).map((step) => ({
        name: step.name,
        at: step.at ? step.at.toISOString() : null,
      })),
    }));
  }

  private calculateEta(order: {
    receivedAt: Date;
    deliveredAt: Date | null;
  }): number {
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
      (process.env.SMTP_TO || process.env.MAIL_TO_TEST || '')
        .toString()
        .trim() ||
      'dev@hapke.local';

    const lines = items
      .map(
        (it) => `• ${it.name} x${it.qty}  (€${(it.price * it.qty).toFixed(2)})`,
      )
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

    await this.mail.sendMail(
      toAddress,
      `Hapke bestelling ${order.orderNumber}`,
      text,
    );
  }
}
