-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('CAFE', 'RESTAURANT');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "type" "CategoryType" NOT NULL DEFAULT 'CAFE';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "optionsJson" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "PendingOrderItem" ADD COLUMN     "optionsJson" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "additionalPrice" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOption_productId_idx" ON "ProductOption"("productId");

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
