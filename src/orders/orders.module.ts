import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersStatusService } from './orders.status.service';
import { OrdersController } from './orders.controller';
import { MailModule } from '../mail/mail.module';
import { PrismaService } from '../prisma/prisma.service';

import { MediaModule } from '../media/media.module';

@Module({
  imports: [PaymentsModule, MailModule, MediaModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStatusService, PrismaService],
})
export class OrdersModule {}
