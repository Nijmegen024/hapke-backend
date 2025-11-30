import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { VendorService } from '../vendor/vendor.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [MediaController],
  providers: [MediaService, VendorService, PrismaService, JwtService],
})
export class MediaModule {}
