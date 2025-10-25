import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(express.urlencoded({ extended: true }));
  app.enableCors({ origin: true, credentials: true });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = '0.0.0.0';

  // --- Simple Vendor Portal (Demo) ---
  const prisma = app.get(PrismaService);

  // Login form
  app.get('/vendor/login', (_req, res) => {
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
  app.post('/vendor/login', async (req, res) => {
    const email = (req.body?.email || '').trim();
    const password = (req.body?.password || '').trim();
    if (!email || !password) return res.status(400).send('Missing email or password');

    const vendor = await prisma.vendor.findUnique({ where: { email } });
    if (!vendor) return res.status(401).send('Invalid credentials');

    // For demo: compare plain text (you can hash later)
    if (vendor.password !== password) return res.status(401).send('Invalid credentials');

    return res.redirect(`/vendor?vid=${vendor.id}`);
  });

  // Vendor orders view (requires ?vid=)
  app.get('/vendor', async (req, res) => {
    const vid = (req.query?.vid as string || '').trim();
    if (!vid) return res.status(400).send('Missing vendor id');

    const vendor = await prisma.vendor.findUnique({ where: { id: vid } });
    if (!vendor) return res.status(404).send('Vendor not found');

    const orders = await prisma.order.findMany({
      where: { vendorId: vid },
      include: { items: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const rows = orders.map((o) => `
      <tr>
        <td>${o.orderNumber}</td>
        <td>${o.status}</td>
        <td>${o.total}</td>
        <td>${o.user?.email ?? '-'}</td>
        <td>${new Date(o.createdAt).toLocaleString()}</td>
      </tr>
    `).join('');

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
  });
  // --- End Simple Vendor Portal ---

  await app.listen(port, host);

  const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  // eslint-disable-next-line no-console
  console.log(`🚀 API running on ${publicUrl}`);
}

bootstrap();
