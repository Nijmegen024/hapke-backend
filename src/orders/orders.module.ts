import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersStatusService } from './orders.status.service';
import { OrdersController } from './orders.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PaymentsModule, MailModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStatusService],
})
export class OrdersModule {}
