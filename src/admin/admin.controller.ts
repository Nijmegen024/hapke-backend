import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('restaurants')
  getRestaurants() {
    return this.adminService.getAllRestaurants();
  }

  @Get('restaurants/:id')
  getRestaurant(@Param('id') id: string) {
    return this.adminService.getRestaurantById(id);
  }

  @Patch('restaurants/:id')
  updateRestaurant(@Param('id') id: string, @Body() body: any) {
    const allowedFields = [
      'name',
      'description',
      'isActive',
      'street',
      'city',
      'postalCode',
      'heroImageUrl',
      'logoImageUrl',
      'minOrder',
      'deliveryFee',
    ];
    const data: any = {};
    const decimalFields = new Set(['minOrder', 'deliveryFee']);
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        data[key] = decimalFields.has(key) ? Number(body[key]) : body[key];
      }
    }
    return this.adminService.updateRestaurant(id, data);
  }

  @Get('orders')
  getOrders(
    @Query('restaurantId') restaurantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getAllOrders({
      restaurantId: restaurantId || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
