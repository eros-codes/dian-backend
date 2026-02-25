import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed some default footer settings
  const defaults = [
    { key: 'address', title: 'تهران، خیابان مثال، پلاک ۱۲۳', url: null as string | null },
    { key: 'phone', title: '09123456789', url: null as string | null },
    { key: 'instagram', title: 'yourshop', url: 'https://instagram.com/yourshop' },
    { key: 'telegram', title: 'yourshop', url: 'https://t.me/yourshop' },
    { key: 'open_time', title: '۱۰ تا ۲۲', url: null as string | null },
    { key: 'fee', title: '45000', url: null as string | null },
  ];

  for (const item of defaults) {
    await prisma.footerSetting.upsert({
      where: { key: item.key },
      update: { title: item.title, url: item.url },
      create: { key: item.key, title: item.title, url: item.url },
    });
  }

  console.log('Seeded footer settings');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
