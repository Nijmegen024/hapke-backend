import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './app.controller';
import { AuthController } from './auth/auth.controller';
import { MailService } from './mail/mail.service';
import { AuthService } from './auth/auth.service';

const mailMock = () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true }),
  verify: jest.fn(),
  configSummary: jest.fn(),
});

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
  let mailService: ReturnType<typeof mailMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: MailService, useFactory: mailMock }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    mailService = module.get(MailService);
  });

  it('sends a confirmation mail when creating an order', async () => {
    const body = { items: [{ id: 'm1', qty: 2 }], email: 'customer@example.com' };

    const result = await controller.create(body);

    expect(mailService.sendMail).toHaveBeenCalledTimes(1);
    expect(mailService.sendMail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.stringContaining('Hapke bestelling'),
      expect.stringContaining('m1'),
    );
    expect(result.mail).toEqual({ ok: true });
  });
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof authMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useFactory: authMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('registreert een nieuwe gebruiker', async () => {
    const result = await controller.register({ email: 'newuser@example.com', password: 'secret!' });

    expect(authService.register).toHaveBeenCalledWith({ email: 'newuser@example.com', password: 'secret!' });
    expect(result).toEqual(fakeAuthResponse);
  });

  it('geeft een JWT terug bij login', async () => {
    const result = await controller.login({ email: 'newuser@example.com', password: 'secret!' });

    expect(authService.login).toHaveBeenCalledWith({ email: 'newuser@example.com', password: 'secret!' });
    expect(result).toEqual(fakeAuthResponse);
  });
});
