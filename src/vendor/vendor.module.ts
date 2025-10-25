import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { VendorController } from './vendor.controller'
import { PrismaService } from '../prisma/prisma.service'

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '30d' } })],
  controllers: [VendorController],
  providers: [PrismaService],
})
export class VendorModule {}
