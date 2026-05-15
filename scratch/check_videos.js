
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const videos = await prisma.video.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        videoUrl: true,
        thumbUrl: true,
        vendorId: true,
      }
    });

    console.log('Videos found:');
    console.log(JSON.stringify(videos, null, 2));
  } catch (error) {
    console.error('Error fetching videos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
