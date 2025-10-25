import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import createMollieClient, { PaymentStatus } from '@mollie/api-client';
import type { MollieClient, PaymentCreateParams } from '@mollie/api-client';
import { v4 as uuid } from 'uuid';
import type { NormalizedOrderItem } from '../pricing';

export interface PaymentStatusResult {
  paymentId: string;
  status: PaymentStatus | 'paid';
  method?: string | null;
  amount?: { value: string; currency: string } | null;
  simulated?: boolean;
}

export const SIMULATED_PAYMENT_PREFIX = 'simulated-payment-';

@Injectable()
export class PaymentsService {
  private readonly mollie: MollieClient | null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor() {
    const apiKey = (process.env.MOLLIE_API_KEY || '').trim();
    if (!apiKey) {
      this.logger.warn(
        'MOLLIE_API_KEY not set – payment creation will return a 400 error.',
      );
      this.mollie = null;
    } else {
      this.mollie = createMollieClient({ apiKey });
    }
  }

  async createPayment(options: {
    method?: string;
    items: NormalizedOrderItem[];
    email?: string;
  }): Promise<{
    paymentId: string;
    checkoutUrl: string | null;
    status: PaymentStatus | 'paid';
    successUrl: string;
    simulated?: true;
  }> {
    if (!this.mollie) {
      throw new BadRequestException('Mollie API key niet geconfigureerd');
    }

    const total = options.items.reduce(
      (sum, item) => sum + item.price * item.qty,
      0,
    );
    const rounded = Math.round(total * 100) / 100;

    const amount = rounded > 0 ? rounded : 0.01;
    const value = amount.toFixed(2);
    const createParams: PaymentCreateParams = {
      amount: {
        value,
        currency: 'EUR',
      },
      description: `Hapke order ${uuid().slice(0, 8)}`,
      redirectUrl: this.getSuccessBaseUrl(),
      webhookUrl: this.getWebhookUrl(),
      metadata: {
        email: options?.email ?? null,
        items: options.items,
      },
    };

    if ((options.method ?? '').toLowerCase() === 'ideal') {
      createParams.method = 'ideal' as PaymentCreateParams['method'];
    }

    try {
      const payment = await this.mollie.payments.create(createParams);
      const successUrl = this.buildSuccessUrl(payment.id);
      try {
        await this.mollie.payments.update(payment.id, {
          redirectUrl: successUrl,
        });
      } catch (updateError: unknown) {
        const message = getErrorMessage(updateError);
        this.logger.warn(
          `Failed to update redirect URL for payment ${payment.id}: ${message}`,
        );
      }
      return {
        paymentId: payment.id,
        checkoutUrl: payment._links.checkout?.href ?? null,
        successUrl,
        status: payment.status,
      };
    } catch (error: unknown) {
      const response = extractErrorResponse(error);
      const statusCode =
        typeof response?.status === 'number' ? response.status : 'n/a';
      const responseBody = response?.body;
      const bodyString =
        typeof responseBody === 'string'
          ? responseBody
          : responseBody
            ? JSON.stringify(responseBody)
            : 'null';
      const message =
        (isRecord(responseBody) && typeof responseBody.detail === 'string'
          ? responseBody.detail
          : null) ||
        getErrorMessage(error) ||
        'Payment creation failed';
      this.logger.error(
        `Failed to create Mollie payment -> message=${getErrorMessage(error)}; status=${statusCode}; body=${bodyString}`,
      );
      throw new BadRequestException(message);
    }
  }

  private buildSuccessUrl(paymentId: string) {
    const baseUrl =
      process.env.PAYMENTS_SUCCESS_URL_BASE ||
      `${(process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://hapke-backend.onrender.com').replace(/\/+$/, '')}/payments/success`;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}id=${encodeURIComponent(paymentId)}`;
  }

  private getSuccessBaseUrl() {
    const explicit = (process.env.PAYMENTS_SUCCESS_URL_BASE || '').trim();
    if (explicit) return explicit;
    const base = (
      process.env.FRONTEND_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'https://hapke-backend.onrender.com'
    ).replace(/\/+$/, '');
    return `${base}/payments/success`;
  }

  private getWebhookUrl() {
    const explicit = (process.env.PAYMENTS_WEBHOOK_URL || '').trim();
    if (explicit) return explicit;
    const base = (
      process.env.RENDER_EXTERNAL_URL || 'https://hapke-backend.onrender.com'
    ).replace(/\/+$/, '');
    return `${base}/payments/webhook`;
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    if (paymentId.startsWith(SIMULATED_PAYMENT_PREFIX)) {
      return {
        paymentId,
        status: 'paid',
        method: 'test-pay-later',
        simulated: true,
        amount: null,
      };
    }

    if (!this.mollie) {
      throw new BadRequestException('Mollie API key niet geconfigureerd');
    }

    try {
      const payment = await this.mollie.payments.get(paymentId);
      return {
        paymentId,
        status: payment.status,
        method: payment.method ?? null,
        amount: payment.amount ?? null,
        simulated: false,
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      this.logger.error(
        `Failed to fetch Mollie payment ${paymentId}: ${message}`,
      );
      throw new InternalServerErrorException('Payment lookup failed');
    }
  }

  private registerSimulatedPayment(paymentId: string, amount: number) {
    this.logger.debug(
      `Simulated payment registered: ${paymentId} amount=${amount}`,
    );
  }

  async ensurePaid(
    paymentId: string,
    expectedAmount: number,
  ): Promise<PaymentStatusResult> {
    const payment = await this.getPaymentStatus(paymentId);
    if (payment.status !== 'paid') {
      throw new BadRequestException(
        `Payment ${paymentId} heeft status ${payment.status}`,
      );
    }
    if (payment.amount?.value) {
      const amountNumber = Number(payment.amount.value);
      const roundedExpected = Math.round(expectedAmount * 100) / 100;
      if (
        !Number.isNaN(amountNumber) &&
        Math.abs(amountNumber - roundedExpected) > 0.01
      ) {
        this.logger.warn(
          `Payment amount mismatch for ${paymentId}: expected ${roundedExpected}, got ${amountNumber}`,
        );
      }
    }
    return payment;
  }
}

type ErrorResponseShape = {
  status?: number;
  body?: unknown;
};

const isRecord = (
  value: unknown,
): value is Record<string | number | symbol, unknown> =>
  typeof value === 'object' && value !== null;

const extractErrorResponse = (
  error: unknown,
): ErrorResponseShape | undefined => {
  if (!isRecord(error) || !('response' in error)) {
    return undefined;
  }
  const response = (error as { response?: unknown }).response;
  return isRecord(response) ? (response as ErrorResponseShape) : undefined;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
