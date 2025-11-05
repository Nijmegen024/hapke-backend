import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VendorController } from './vendor.controller';
import { PrismaService } from '../prisma/prisma.service';
import { VendorService } from './vendor.service';

@Module({
  imports: [
    JwtModule.register({
      secret:
        process.env.JWT_ACCESS_SECRET ??
        process.env.JWT_SECRET ??
        'dev-access-secret',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [VendorController],
  providers: [PrismaService, VendorService],
  exports: [VendorService],
})
export class VendorModule {}
