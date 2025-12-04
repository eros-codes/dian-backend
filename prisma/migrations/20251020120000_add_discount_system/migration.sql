-- Migration: add_discount_system
-- Safe add of originalPrice column, backfill, and set NOT NULL
BEGIN;

-- 1) Add column as nullable
ALTER TABLE "Product" ADD COLUMN "originalPrice" decimal(15,2);

-- 2) If there is an existing price column, backfill from it
-- (adjust the column name if your old price column has a different name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Product' AND column_name='price') THEN
    UPDATE "Product" SET "originalPrice" = "price" WHERE "originalPrice" IS NULL;
  END IF;
END$$;

-- 3) For any remaining NULLs (defensive), set to 0.00
UPDATE "Product" SET "originalPrice" = 0.00 WHERE "originalPrice" IS NULL;

-- 4) Make column NOT NULL
ALTER TABLE "Product" ALTER COLUMN "originalPrice" SET NOT NULL;

COMMIT;
