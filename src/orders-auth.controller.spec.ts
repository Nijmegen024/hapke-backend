import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { OrdersController } from './orders/orders.controller';
import { AuthController } from './auth/auth.controller';
import { OrdersService } from './orders/orders.service';
import { AuthService } from './auth/auth.service';
import { CreateOrderDto } from './orders/dto/create-order.dto';

const ordersMock = () => ({
  createOrder: jest.fn().mockResolvedValue({ orderId: 'ORD-1' }),
  getOrderStatus: jest.fn(),
  getOrderDetail: jest.fn(),
});

type TestRequest = Request & { user?: { sub?: string; id?: string } };

const fakeUser = {
  id: 'user-123',
  email: 'newuser@example.com',
  name: 'Aeren',
  createdAt: new Date(),
};

const fakeAuthResponse = {
  user: fakeUser,
  access_token: 'access-xyz',
};

const authMock = () => ({
  register: jest.fn().mockResolvedValue(fakeAuthResponse),
  login: jest.fn().mockResolvedValue(fakeAuthResponse),
  getUserById: jest.fn(),
});

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: ReturnType<typeof ordersMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useFactory: ordersMock }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get(OrdersService);
  });

  it('roept OrdersService aan bij aanmaken van een order', async () => {
    const body: CreateOrderDto = {
      items: [{ id: 'm1', qty: 2 }],
      paymentId: 'pay-1',
    };
    const req = { user: { sub: 'user-1' } } as TestRequest;

    await controller.create(body, req);

    expect(ordersService.createOrder).toHaveBeenCalledWith('user-1', body);
  });
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof authMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useFactory: authMock }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('registreert een nieuwe gebruiker', async () => {
    const result = await controller.register({
      email: 'newuser@example.com',
      password: 'secret!',
    });

    expect(authService.register).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      password: 'secret!',
    });
    expect(result).toEqual(fakeAuthResponse);
  });

  it('geeft een JWT terug bij login', async () => {
    const result = await controller.login({
      email: 'newuser@example.com',
      password: 'secret!',
    });

    expect(authService.login).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      password: 'secret!',
    });
    expect(result).toEqual(fakeAuthResponse);
  });
});
