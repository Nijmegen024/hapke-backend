import { Body, Controller, Get, Patch, Post, Param, Query, UnauthorizedException, Req, HttpException, HttpStatus } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { OrderStatus } from '@prisma/client'

@Controller('vendor')
export class VendorController {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body
    if (!email || !password) throw new UnauthorizedException('Email en wachtwoord verplicht')
    const token = await this.jwt.signAsync({ sub: email, role: 'vendor', restaurantId: 'r1' })
    return { token }
  }

  @Get('orders')
  async getOrders(@Req() req: any, @Query('status') status?: string) {
    this.decode(req)
    return this.prisma.order.findMany({
      include: { items: true },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    })
  }

  @Patch('orders/:id/status')
  async updateStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: string) {
    this.decode(req)
    if (!status) throw new HttpException({ result: 'blocked', reason: 'status_missing' }, HttpStatus.BAD_REQUEST)
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new HttpException({ result: 'blocked', reason: 'status_invalid' }, HttpStatus.BAD_REQUEST)
    }

    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) {
      throw new HttpException({ result: 'blocked', reason: 'order_not_found' }, HttpStatus.BAD_REQUEST)
    }
    const nextStatus = status as OrderStatus

    const statusFlow = [OrderStatus.RECEIVED, OrderStatus.PREPARING, OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED] as const
    const currentIndex = statusFlow.indexOf(order.status)
    const allowedNext = currentIndex >= 0 ? statusFlow[currentIndex + 1] ?? null : null

    if (nextStatus !== allowedNext) {
      throw new HttpException({ result: 'blocked', reason: 'transition_invalid' }, HttpStatus.CONFLICT)
    }

    await this.prisma.order.update({
      where: { id },
      data: { status: nextStatus },
    })
    return { result: 'updated' }
  }

  private decode(req: any) {
    const auth = req.headers['authorization'] || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) throw new UnauthorizedException('Geen token')
    const payload = this.jwt.decode(token) as any
    if (!payload || payload.role !== 'vendor') throw new UnauthorizedException('Token ongeldig')
    return payload
  }
}
