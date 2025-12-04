-- Migration: add paymentMethod and trackingCode to Order (safe, non-destructive)

BEGIN;

-- 1) Add new columns as nullable so we don't break existing rows
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingCode" TEXT;

-- 2) Backfill existing rows with a sensible default
UPDATE "Order" SET "paymentMethod" = 'COD' WHERE "paymentMethod" IS NULL;

-- 3) Make paymentMethod non-nullable and set a default for future inserts
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET DEFAULT 'COD';
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET NOT NULL;

COMMIT;

-- Note: We intentionally use TEXT for paymentMethod rather than a Postgres enum to simplify migrations.
-- If you prefer a Postgres enum type, create the enum first, migrate existing TEXT values into it, then alter the column type.
