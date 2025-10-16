import { Module } from '@nestjs/common';
import { AppController, RestaurantsController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ChatsService } from './chats/chats.service';
import { ChatsController } from './chats/chats.controller';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { MailModule } from './mail/mail.module';
import { VendorModule } from './vendor/vendor.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrdersModule,
    PaymentsModule,
    VendorModule,
    MailModule,
  ],
  controllers: [
    AppController,
    RestaurantsController,
    HealthController,
    ChatsController,
  ],
  providers: [AppService, ChatsService],
})
export class AppModule {}
