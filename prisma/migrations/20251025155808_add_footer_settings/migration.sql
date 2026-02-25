-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "discountPercent" DROP NOT NULL,
ALTER COLUMN "discountPercent" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FooterSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "is_link" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FooterSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FooterSetting_key_key" ON "FooterSetting"("key");
