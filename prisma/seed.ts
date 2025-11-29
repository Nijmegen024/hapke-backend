import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'info@hapke.nl';
  const plainPassword = 'hapke123';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      passwordHash,
      name: 'Hapke Admin',
      isVerified: true,
    },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
      name: 'Hapke Admin',
      isVerified: true,
    },
  });

  console.log('Admin user ready:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
