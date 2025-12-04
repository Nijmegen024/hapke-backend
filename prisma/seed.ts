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

  const vendors = [
    {
      email: 'info@hapke.nl',
      name: 'Hapke Demo Restaurant',
      city: 'Nijmegen',
      postalCode: '6511 AB',
      street: 'Demo Straat 1',
      description: 'Demo restaurant voor beheer',
    },
    {
      email: 'pizzeria@hapke.nl',
      name: 'Pizzeria Napoli',
      city: 'Nijmegen',
      postalCode: '6511 AB',
      street: 'Pizzaweg 1',
      description: 'Verse pizza uit steenoven',
    },
    {
      email: 'sushi@hapke.nl',
      name: 'Sushi Nijmeegs',
      city: 'Nijmegen',
      postalCode: '6512 CD',
      street: 'Sashimistraat 5',
      description: 'Sushi en bowls',
    },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { email: v.email },
      update: {},
      create: {
        email: v.email,
        passwordHash: await bcrypt.hash('hapke123', 10),
        name: v.name,
        city: v.city,
        postalCode: v.postalCode,
        street: v.street,
        description: v.description,
        isActive: true,
      },
    });
  }

  console.log('Admin user ready:', email);
  console.log('Vendors ready:', vendors.map((v) => v.email).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
