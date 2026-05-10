const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://hapke_db_user:Hcb8IX8tLLGEU3VIGsSxiyrauDxImexY@dpg-d3mcssvdiees73f9v7ag-a.frankfurt-postgres.render.com/hapke_db',
    },
  },
});

function stripSupabaseUrl(url) {
  if (!url) return null;
  // Matches any Supabase storage public URL pattern
  const regex = /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/[^/]+\//;
  return url.replace(regex, '');
}

async function main() {
  try {
    console.log('Starting migration to relative paths...');

    // 1. Migrate Videos
    const videos = await prisma.video.findMany();
    console.log(`Checking ${videos.length} videos...`);
    for (const v of videos) {
      const newVideoUrl = stripSupabaseUrl(v.videoUrl);
      const newThumbUrl = stripSupabaseUrl(v.thumbUrl);
      
      if (newVideoUrl !== v.videoUrl || newThumbUrl !== v.thumbUrl) {
        await prisma.video.update({
          where: { id: v.id },
          data: { videoUrl: newVideoUrl, thumbUrl: newThumbUrl },
        });
        console.log(`Updated Video ID: ${v.id}`);
      }
    }

    // 2. Migrate Vendors (heroImageUrl, logoImageUrl)
    const vendors = await prisma.vendor.findMany();
    console.log(`Checking ${vendors.length} vendors...`);
    for (const v of vendors) {
      const newHero = stripSupabaseUrl(v.heroImageUrl);
      const newLogo = stripSupabaseUrl(v.logoImageUrl);
      
      if (newHero !== v.heroImageUrl || newLogo !== v.logoImageUrl) {
        await prisma.vendor.update({
          where: { id: v.id },
          data: { heroImageUrl: newHero, logoImageUrl: newLogo },
        });
        console.log(`Updated Vendor ID: ${v.id}`);
      }
    }

    // 3. Migrate Menu Items (imageUrl)
    const items = await prisma.vendorMenuItem.findMany();
    console.log(`Checking ${items.length} menu items...`);
    for (const item of items) {
      const newImg = stripSupabaseUrl(item.imageUrl);
      
      if (newImg !== item.imageUrl) {
        await prisma.vendorMenuItem.update({
          where: { id: item.id },
          data: { imageUrl: newImg },
        });
        console.log(`Updated Menu Item ID: ${item.id}`);
      }
    }

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('MIGRATION ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
