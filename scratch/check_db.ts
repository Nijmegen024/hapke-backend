import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const videos = await prisma.video.findMany({
    take: 5,
  });
  console.log('Sample Videos:');
  console.log(JSON.stringify(videos, null, 2));
  
  const totalVideos = await prisma.video.count();
  console.log('Total Videos:', totalVideos);

  const supabaseVideos = await prisma.video.findMany({
    where: {
      videoUrl: {
        contains: 'supabase',
      },
    },
    take: 5,
  });
  console.log('Supabase Videos:');
  console.log(JSON.stringify(supabaseVideos, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
