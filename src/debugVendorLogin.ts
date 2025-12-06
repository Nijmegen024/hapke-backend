import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function run() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://hapke_db_user:Hcb8IX8tLLGEU3VIGsSxiyrauDxImexY@dpg-d3mcssvdiees73f9v7ag-a.frankfurt-postgres.render.com/hapke_db',
      },
    },
  });

  const email = 'pizzeria@hapke.nl';
  const plainPassword = 'hapke123';

  const vendor = await prisma.vendor.findUnique({
    where: { email },
  });

  console.log('VENDOR FROM DB:', vendor);

  if (!vendor || !vendor.passwordHash) {
    console.log('GEEN vendor of GEEN passwordHash');
    process.exit(0);
  }

  const ok = await bcrypt.compare(plainPassword, vendor.passwordHash);
  console.log('BCRYPT OK:', ok);

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
