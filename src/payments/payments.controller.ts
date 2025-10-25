import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { normalizeItems } from '../pricing';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create')
  async create(
    @Body()
    body: {
      method?: string;
      items?: { id: string; qty: number }[];
      email?: string;
    },
  ) {
    const normalized = normalizeItems(
      Array.isArray(body?.items) ? body.items : [],
    );
    return this.payments.createPayment({
      method: body?.method,
      items: normalized,
      email: body?.email,
    });
  }

  @Get('success')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async success(@Query('id') id?: string) {
    if (!id) {
      return 'Geen paymentId ontvangen.';
    }
    try {
      const result = await this.payments.getPaymentStatus(id);
      return `Betaling status: ${result.status}`;
    } catch {
      return 'Status niet beschikbaar.';
    }
  }

  @Get(':id')
  async getPayment(@Param('id') id: string) {
    const payment = await this.payments.getPaymentStatus(id);
    return {
      paymentId: payment.paymentId,
      status: payment.status,
      amount: payment.amount ?? null,
      method: payment.method ?? null,
    };
  }

  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return this.payments.getPaymentStatus(id);
  }
}
