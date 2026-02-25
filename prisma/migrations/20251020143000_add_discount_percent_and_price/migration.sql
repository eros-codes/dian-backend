-- Migration: add_discount_percent_and_price
-- Adds discountPercent to Category and Product, adds price to Product and backfills from originalPrice
BEGIN;

-- 1) Category.discountPercent
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "discountPercent" integer;
UPDATE "Category" SET "discountPercent" = 0 WHERE "discountPercent" IS NULL;
ALTER TABLE "Category" ALTER COLUMN "discountPercent" SET DEFAULT 0;
ALTER TABLE "Category" ALTER COLUMN "discountPercent" SET NOT NULL;

-- 2) Product.discountPercent
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "discountPercent" integer;
UPDATE "Product" SET "discountPercent" = 0 WHERE "discountPercent" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "discountPercent" SET DEFAULT 0;
ALTER TABLE "Product" ALTER COLUMN "discountPercent" SET NOT NULL;

-- 3) Product.price
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "price" decimal(15,2);
-- Backfill: price = originalPrice * (1 - discountPercent/100)
UPDATE "Product"
SET "price" = ROUND(("originalPrice" * (1 - (COALESCE("discountPercent", 0)::numeric / 100)))::numeric, 2)
WHERE "price" IS NULL;
-- Defensive: if originalPrice is null, fall back to 0
UPDATE "Product" SET "price" = 0.00 WHERE "price" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "price" SET NOT NULL;

COMMIT;
