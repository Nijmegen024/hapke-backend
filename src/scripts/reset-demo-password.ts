import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const email = 'demo@restaurant.nl';
  const newPass = 'hapke123';
  const hash = await bcrypt.hash(newPass, 10);

  const before = await prisma.user.findUnique({ where: { email } });
  console.log('Voor:', !!before, before?.updatedAt);

  const res = await prisma.user.updateMany({
    where: { email },
    data: { passwordHash: hash },
  });
  if (res.count === 0)
    console.log('Geen update gedaan (bestond niet of al gelijk).');

  const after = await prisma.user.findUnique({ where: { email } });
  console.log('Na :', !!after, after?.updatedAt);
  console.log(`✅ Wachtwoord ingesteld voor ${email}: ${newPass}`);
}
main().finally(() => prisma.$disconnect());
