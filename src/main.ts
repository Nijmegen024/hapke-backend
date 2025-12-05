import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { Express, Request, Response } from 'express';
import { VendorService } from './vendor/vendor.service';

type VendorLoginBody = {
  email?: string;
  password?: string;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.enableCors({ origin: true, credentials: true });

  const port = process.env.PORT || 3000;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const server = app.getHttpAdapter().getInstance();
  ensureExpressServer(server);
  // --- Simple Vendor Portal (Demo) ---
  const vendorService = app.get(VendorService);
  const vendorBaseUrl =
    process.env.VENDOR_PORTAL_BASE_URL || 'https://hapke-backend.onrender.com';

  // Login form
  server.get('/vendor/login', (_req: Request, res: Response) => {
    const html = `<!doctype html>
    <html><head><meta charset="utf-8"><title>Vendor Login</title>
    <style>
      :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      body { margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; background: #f6f7fb; }
      .card { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); width: 360px; }
      h2 { margin-top: 0; }
      label { display: block; margin-bottom: 12px; font-weight: 600; }
      input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cfd3e1; margin-top: 6px; font-size: 15px; }
      button { width: 100%; margin-top: 12px; padding: 10px; border-radius: 8px; border: none; background: #111; color:#fff; font-weight: 600; cursor:pointer; }
      .error { color: #b42318; margin-top: 12px; min-height: 20px; }
    </style></head>
    <body>
      <div class="card">
        <h2>Vendor login</h2>
        <form id="loginForm">
          <label>Email<input name="email" type="email" required></label>
          <label>Password<input name="password" type="password" required></label>
          <button type="submit">Log in</button>
        </form>
        <div class="error" id="error"></div>
      </div>
      <script>
        const BASE_URL = '${vendorBaseUrl}';
        const TOKEN_KEY = 'vendor_token';
        document.getElementById('loginForm').addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const email = form.email.value.trim();
          const password = form.password.value.trim();
          const errorEl = document.getElementById('error');
          errorEl.textContent = '';
          try {
            const response = await fetch(\`\${BASE_URL}/vendor/login\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            if (response.status === 401) {
              errorEl.textContent = 'Ongeldige inloggegevens';
              return;
            }
            if (!response.ok) {
              const text = await response.text();
              throw new Error(text || 'Inloggen mislukt');
            }
            const data = await response.json();
            if (!data?.token) throw new Error('Geen token ontvangen');
            localStorage.setItem(TOKEN_KEY, data.token);
            window.location.href = '/vendor';
          } catch (err) {
            errorEl.textContent = err?.message || String(err);
          }
        });
      </script>
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
      try {
        const emailRaw = req.body?.email;
        const passwordRaw = req.body?.password;
        const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
        const password =
          typeof passwordRaw === 'string' ? passwordRaw.trim() : '';
        if (!email || !password) {
          return res.status(400).send('Missing email or password');
        }

        const { accessToken, vendor } = await vendorService.login(
          email,
          password,
        );
        vendorService.applyAuthCookie(res, accessToken);
        return res.json({
          result: 'ok',
          token: accessToken,
          vendor,
        });
      } catch (error) {
        const status =
          (error as { status?: number }).status === 400 ? 400 : 401;
        return res.status(status).send('Invalid credentials');
      }
    },
  );

  server.post('/vendor/logout', (_req: Request, res: Response) => {
    vendorService.clearAuthCookie(res);
    return res.json({ result: 'logged_out' });
  });

  // Vendor orders portal (client-rendered dashboard)
  server.get('/vendor', (_req: Request, res: Response) => {
    const html = `<!doctype html>
      <html><head>
        <meta charset="utf-8" />
        <title>Vendor Orders</title>
        <style>
          :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; }
          body { margin: 0; background: #f4f6fb; min-height: 100vh; }
          header { background: #fff; padding: 16px 24px; box-shadow: 0 1px 4px rgba(15,23,42,0.08); display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:10; }
          h1 { margin:0; font-size: 20px; }
          main { padding: 24px; }
          table { width:100%; border-collapse: collapse; background:#fff; border-radius: 12px; overflow:hidden; box-shadow: 0 8px 24px rgba(15,23,42,0.08); }
          th, td { padding: 12px 16px; text-align:left; border-bottom:1px solid #e2e8f0; }
          th { background:#f8fafc; font-size:13px; text-transform:uppercase; letter-spacing:0.05em; color:#475569; }
          tr:last-child td { border-bottom:none; }
          .status { display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; font-size:13px; font-weight:600; }
          .status.RECEIVED { background:#e0f2fe; color:#0369a1; }
          .status.PREPARING { background:#fef3c7; color:#b45309; }
          .status.ON_THE_WAY { background:#ede9fe; color:#6d28d9; }
          .status.DELIVERED { background:#dcfce7; color:#15803d; }
          .actions { display:flex; gap:8px; flex-wrap:wrap; }
          button.action { border:none; border-radius:8px; padding:6px 12px; font-weight:600; cursor:pointer; color:#fff; background:#0f172a; }
          button.action:disabled { opacity:0.3; cursor:not-allowed; }
          #message { margin: 12px 0 0; color:#dc2626; min-height: 20px; }
        </style>
      </head>
      <body>
        <header>
          <h1>Vendor Orders</h1>
          <button id="logoutBtn" style="border:none;background:#e11d48;color:#fff;padding:8px 14px;border-radius:8px;font-weight:600;cursor:pointer;">Log out</button>
        </header>
        <main>
          <div id="message"></div>
          <table>
            <thead>
              <tr><th>Order</th><th>Status</th><th>Total</th><th>Customer</th><th>Updated</th><th>Actions</th></tr>
            </thead>
            <tbody id="ordersBody">
              <tr><td colspan="6" style="text-align:center;padding:24px;">Orders laden...</td></tr>
            </tbody>
          </table>
        </main>
        <script>
          const BASE_URL='${vendorBaseUrl}';
          const TOKEN_KEY='vendor_token';
          const ordersBody=document.getElementById('ordersBody');
          const messageEl=document.getElementById('message');
          const statusFlow=['RECEIVED','PREPARING','ON_THE_WAY','DELIVERED'];
          document.getElementById('logoutBtn').addEventListener('click',()=>{localStorage.removeItem(TOKEN_KEY); window.location.href='/vendor/login';});

          function requireToken(){
            const token=localStorage.getItem(TOKEN_KEY);
            if(!token){ window.location.replace('/vendor/login'); return null; }
            return token;
          }

          function handleUnauthorized(){
            localStorage.removeItem(TOKEN_KEY);
            window.location.replace('/vendor/login');
          }

          async function fetchOrders(){
            const token=requireToken();
            if(!token) return;
            try{
              const res=await fetch(\`\${BASE_URL}/vendor/orders\`,{ headers:{ Authorization:\`Bearer \${token}\` }});
              if(res.status===401) return handleUnauthorized();
              if(!res.ok) throw new Error('Orders ophalen mislukt');
              const data=await res.json();
              renderOrders(Array.isArray(data)?data:[]);
              messageEl.textContent='';
            }catch(err){
              messageEl.textContent=err?.message || String(err);
            }
          }

          function formatCurrency(value){
            if(value == null) return '0.00';
            if (typeof value === 'object' && value !== null) {
              if ('value' in value) {
                const parsed = Number(value.value);
                if (!Number.isNaN(parsed)) return parsed.toFixed(2);
              }
              if ('toString' in value) {
                const parsed = Number(value.toString());
                if (!Number.isNaN(parsed)) return parsed.toFixed(2);
              }
            }
            const amount=Number(value);
            return Number.isFinite(amount)?amount.toFixed(2):'0.00';
          }

          function renderOrders(orders){
            if(!orders.length){
              ordersBody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;">Nog geen orders</td></tr>';
              return;
            }
            ordersBody.innerHTML='';
            orders.forEach((order)=>{
              const tr=document.createElement('tr');
              tr.dataset.orderId=order.id;
              const totalDisplay=formatCurrency(order.total);
              tr.innerHTML=\`
                <td>\${order.orderNumber || order.id}</td>
                <td><span class="status \${order.status}">\${order.status}</span></td>
                <td>€\${totalDisplay}</td>
                <td>\${order.user?.email ?? 'Onbekend'}</td>
                <td>\${order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '-'}</td>
                <td class="actions"></td>
              \`;
              const actionsCell=tr.querySelector('.actions');
              ['PREPARING','ON_THE_WAY','DELIVERED'].forEach((targetStatus)=>{
                const btn=document.createElement('button');
                btn.className='action';
                btn.textContent=labelForStatus(targetStatus);
                btn.disabled=!canTransition(order.status,targetStatus);
                btn.addEventListener('click',()=>updateStatus(order,tr,targetStatus));
                actionsCell?.appendChild(btn);
              });
              ordersBody.appendChild(tr);
            });
          }

          function labelForStatus(status){
            if(status==='PREPARING') return 'Prepare';
            if(status==='ON_THE_WAY') return 'On the way';
            if(status==='DELIVERED') return 'Delivered';
            return status;
          }

          function canTransition(current,target){
            const currentIdx=statusFlow.indexOf(current);
            const targetIdx=statusFlow.indexOf(target);
            if(currentIdx===-1 || targetIdx===-1) return false;
            return targetIdx===currentIdx+1;
          }

          async function updateStatus(order,row,targetStatus){
            const token=requireToken();
            if(!token) return;
            const previousStatus=order.status;
            applyStatus(row, targetStatus);
            order.status=targetStatus;
            try{
              const res=await fetch(\`\${BASE_URL}/vendor/orders/\${order.id}/status\`,{
                method:'PATCH',
                headers:{
                  'Content-Type':'application/json',
                  Authorization:\`Bearer \${token}\`
                },
                body: JSON.stringify({ status: targetStatus })
              });
              if(res.status===401) return handleUnauthorized();
              if(!res.ok){
                throw new Error('Status bijwerken mislukt');
              }
              messageEl.textContent='';
            }catch(err){
              applyStatus(row, previousStatus);
              order.status=previousStatus;
              messageEl.textContent=err?.message || String(err);
            }
          }

          function applyStatus(row,status){
            const badge=row.querySelector('.status');
            if(badge){
              badge.textContent=status;
              badge.className='status '+status;
            }
            const buttons=row.querySelectorAll('button.action');
            const transitions=['PREPARING','ON_THE_WAY','DELIVERED'];
            buttons.forEach((btn,idx)=>{
              btn.disabled=!canTransition(status,transitions[idx]);
            });
          }

          fetchOrders();
          setInterval(fetchOrders,5000);
        </script>
      </body></html>`;
    return res.type('html').send(html);
  });
  // --- End Simple Vendor Portal ---

  await app.listen(process.env.PORT || 3000);

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
