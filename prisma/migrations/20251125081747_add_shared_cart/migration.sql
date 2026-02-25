-- CreateTable
CREATE TABLE "shared_carts" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "baseUnitPrice" DECIMAL(15,2) NOT NULL,
    "optionsSubtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_carts_createdAt_idx" ON "shared_carts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "shared_carts_tableId_key" ON "shared_carts"("tableId");

-- CreateIndex
CREATE INDEX "shared_cart_items_cartId_idx" ON "shared_cart_items"("cartId");

-- CreateIndex
CREATE INDEX "shared_cart_items_productId_idx" ON "shared_cart_items"("productId");

-- AddForeignKey
ALTER TABLE "shared_cart_items" ADD CONSTRAINT "shared_cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "shared_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
