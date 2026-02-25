-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN     "categoryOptionId" INTEGER;

-- CreateTable
CREATE TABLE "CategoryOption" (
    "id" SERIAL NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "additionalPrice" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoryOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryOption_categoryId_idx" ON "CategoryOption"("categoryId");

-- CreateIndex
CREATE INDEX "ProductOption_categoryOptionId_idx" ON "ProductOption"("categoryOptionId");

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_categoryOptionId_fkey" FOREIGN KEY ("categoryOptionId") REFERENCES "CategoryOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOption" ADD CONSTRAINT "CategoryOption_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
