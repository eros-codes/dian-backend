// backfill-soldcount.js
// Usage: from backend folder run `node ./scripts/backfill-soldcount.js`
// It will compute soldCount per product as the sum of quantities in DELIVERED orders

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Computing sold counts from DELIVERED orders...');
  // Aggregate delivered quantities per product
  const rows = await prisma.$queryRaw`
    SELECT oi."productId", SUM(oi.quantity) as total
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o.status = 'DELIVERED'
    GROUP BY oi."productId";
  `;

  // rows: array of { productId: string, total: string }
  for (const r of rows) {
    const productId = r.productId || r.productid || r.product_id;
    const total = Number(r.total || r.totalcount || r.sum || r.total_quantity || 0);
    console.log(`Setting soldCount=${total} for product ${productId}`);
    try {
      await prisma.product.update({ where: { id: productId }, data: { soldCount: total } });
    } catch (e) {
      console.warn('Failed to update product', productId, e.message || e);
    }
  }

  // Also set 0 for products not present in the aggregation
  const allProducts = await prisma.product.findMany({ select: { id: true } });
  for (const p of allProducts) {
    const exists = rows.find((r) => (r.productId === p.id || r.productid === p.id));
    if (!exists) {
      try {
        await prisma.product.update({ where: { id: p.id }, data: { soldCount: 0 } });
      } catch (e) {
        // ignore
      }
    }
  }

  console.log('Backfill complete');
}

main()
  .catch((e) => {
    console.error('Backfill failed', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
