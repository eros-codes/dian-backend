-- AlterTable
ALTER TABLE "public"."Order" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(15,2);

-- AlterTable
ALTER TABLE "public"."OrderItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(15,2),
ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(15,2);

-- AlterTable
ALTER TABLE "public"."Product" ALTER COLUMN "price" SET DATA TYPE DECIMAL(15,2);

-- AlterTable
ALTER TABLE "public"."Return" ALTER COLUMN "refundAmount" SET DATA TYPE DECIMAL(15,2);
