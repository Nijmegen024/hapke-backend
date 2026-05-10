require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://hapke_db_user:Hcb8IX8tLLGEU3VIGsSxiyrauDxImexY@dpg-d3mcssvdiees73f9v7ag-a.frankfurt-postgres.render.com/hapke_db',
    },
  },
});

async function main() {
  try {
    const totalVideos = await prisma.video.count();
    console.log('Total Videos:', totalVideos);

    const supabaseVideos = await prisma.video.findMany({
      where: {
        videoUrl: {
          contains: 'supabase',
        },
      },
      take: 10,
    });
    
    console.log('Videos with Supabase URLs:');
    supabaseVideos.forEach(v => {
      console.log(`- ID: ${v.id}, URL: ${v.videoUrl}`);
    });

  } catch (error) {
    console.error('DATABASE ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
