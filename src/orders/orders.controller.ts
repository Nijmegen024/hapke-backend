import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

interface AuthenticatedRequest extends Request {
  user?: { sub?: string; id?: string };
}

@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateOrderDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.orders.createOrder(userId, dto);
  }

  @Get(':orderId/status')
  async status(@Param('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.orders.getOrderStatus(orderId, userId);
  }

  @Get(':orderId')
  async getOrder(@Param('orderId') orderId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.orders.getOrderDetail(orderId, userId);
  }
}
