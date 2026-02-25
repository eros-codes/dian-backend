/*
  Warnings:

  - You are about to drop the column `shippingAddress` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `brand` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the `Return` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Return" DROP CONSTRAINT "Return_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Return" DROP CONSTRAINT "Return_userId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "shippingAddress";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "brand",
DROP COLUMN "quantity";

-- DropTable
DROP TABLE "public"."Return";

-- DropEnum
DROP TYPE "public"."ReturnStatus";
