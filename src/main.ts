import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import express from 'express';
import type { Express, Request, Response } from 'express';

type VendorLoginBody = {
  email?: string;
  password?: string;
};

type VendorQuery = {
  vid?: string | string[];
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(express.urlencoded({ extended: true }));
  app.enableCors({ origin: true, credentials: true });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = '0.0.0.0';

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const server = app.getHttpAdapter().getInstance();
  ensureExpressServer(server);
  // --- Simple Vendor Portal (Demo) ---
  const prisma = app.get(PrismaService);

  // Login form
  server.get('/vendor/login', (_req: Request, res: Response) => {
    const html = `<!doctype html>
    <html><head><meta charset="utf-8"><title>Vendor Login</title>
    <style>body{font-family:system-ui;padding:24px;max-width:480px;margin:auto}</style></head>
    <body>
      <h2>Vendor login</h2>
      <form method="post" action="/vendor/login">
        <label>Email<br><input name="email" type="email" required></label><br><br>
        <label>Password<br><input name="password" type="password" required></label><br><br>
        <button type="submit">Log in</button>
      </form>
    </body></html>`;
    return res.type('html').send(html);
  });

  // Handle login (very simple, demo-only)
  server.post(
    '/vendor/login',
    async (
      req: Request<Record<string, string>, unknown, VendorLoginBody>,
      res: Response,
    ) => {
      const emailRaw = req.body?.email;
      const passwordRaw = req.body?.password;
      const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
      const password =
        typeof passwordRaw === 'string' ? passwordRaw.trim() : '';
      if (!email || !password) {
        return res.status(400).send('Missing email or password');
      }

      const vendor = await prisma.vendor.findUnique({ where: { email } });
      if (!vendor) return res.status(401).send('Invalid credentials');

      // For demo: compare plain text (you can hash later)
      if (vendor.password !== password) {
        return res.status(401).send('Invalid credentials');
      }

      return res.redirect(`/vendor?vid=${vendor.id}`);
    },
  );

  // Vendor orders view (requires ?vid=)
  server.get(
    '/vendor',
    async (
      req: Request<Record<string, string>, unknown, unknown, VendorQuery>,
      res: Response,
    ) => {
      const vidParam = req.query.vid;
      const vid = typeof vidParam === 'string' ? vidParam.trim() : '';
      if (!vid) return res.status(400).send('Missing vendor id');

      const vendor = await prisma.vendor.findUnique({ where: { id: vid } });
      if (!vendor) return res.status(404).send('Vendor not found');

      const orders = await prisma.order.findMany({
        where: { vendorId: vid },
        include: { items: true, user: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const rows = orders
        .map((o) => {
          const totalDisplay = Number(o.total).toFixed(2);
          return `
      <tr>
        <td>${o.orderNumber}</td>
        <td>${o.status}</td>
        <td>€${totalDisplay}</td>
        <td>${o.user?.email ?? '-'}</td>
        <td>${new Date(o.createdAt).toLocaleString()}</td>
      </tr>
    `;
        })
        .join('');

      const html = `<!doctype html>
      <html><head>
        <meta charset="utf-8" />
        <title>Vendor Orders</title>
        <meta http-equiv="refresh" content="5" />
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ddd; padding: 8px; font-size: 14px; }
          th { background: #f3f3f3; text-align: left; }
          .top { display:flex; justify-content:space-between; align-items:center; }
        </style>
      </head>
      <body>
        <div class="top">
          <h2>Vendor Orders — ${vendor.name}</h2>
          <a href="/vendor/login">Log out</a>
        </div>
        <table>
          <thead>
            <tr><th>Order</th><th>Status</th><th>Total</th><th>User</th><th>Created</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>`;
      return res.type('html').send(html);
    },
  );
  // --- End Simple Vendor Portal ---

  await app.listen(port, host);

  const publicUrl =
    process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

  console.log(`🚀 API running on ${publicUrl}`);
}

void bootstrap();

function ensureExpressServer(instance: unknown): asserts instance is Express {
  if (!instance || typeof (instance as Partial<Express>).get !== 'function') {
    throw new Error('HTTP adapter must be an Express server');
  }
}
