import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  AppController,
  RestaurantsController,
  VideosController,
} from './app.controller';
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
import { AdminModule } from './admin/admin.module';
import { RolesGuard } from './auth/roles.guard';
import { MediaModule } from './media/media.module';
import { DebugController } from './debug.controller';

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
    AdminModule,
    MediaModule,
  ],
  controllers: [
    AppController,
    RestaurantsController,
    VideosController,
    HealthController,
    DebugController,
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
