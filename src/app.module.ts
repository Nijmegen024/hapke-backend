import { Module } from '@nestjs/common';
import { AppController, RestaurantsController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { MailModule } from './mail/mail.module';
import { VendorModule } from './vendor/vendor.module';
import { UsersModule } from './users/users.module';
import { ChatsModule } from './chats/chats.module';
import { FriendsModule } from './friends/friends.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrdersModule,
    PaymentsModule,
    VendorModule,
    MailModule,
    UsersModule,
    ChatsModule,
    FriendsModule,
  ],
  controllers: [
    AppController,
    RestaurantsController,
    HealthController,
  ],
  providers: [AppService],
})
export class AppModule {}
