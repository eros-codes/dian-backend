const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const top = await prisma.product.findMany({ where: { isActive: true }, orderBy: { soldCount: 'desc' }, take: 8 });
  console.log('Top products by soldCount:');
  top.forEach(p => console.log({ id: p.id, name: p.name, soldCount: p.soldCount }));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
