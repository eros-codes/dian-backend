BEGIN;

-- 1) Create Category table if missing
CREATE TABLE IF NOT EXISTS "public"."Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Ensure unique name to match Prisma schema
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Category_name_key'
  ) THEN
    CREATE UNIQUE INDEX "Category_name_key" ON "public"."Category"("name");
  END IF;
END $$;

-- 2) Add nullable categoryId to Product (if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'categoryId'
  ) THEN
    ALTER TABLE "public"."Product" ADD COLUMN "categoryId" TEXT;
  END IF;
END $$;

-- 3) Seed Category rows from distinct Product.category values
INSERT INTO "public"."Category" ("id", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT md5(lower(p."category")) AS id,
       p."category" AS name,
       NULL::TEXT AS description,
       true AS isActive,
       NOW() AS createdAt,
       NOW() AS updatedAt
FROM "public"."Product" p
LEFT JOIN "public"."Category" c ON c."name" = p."category"
WHERE c."id" IS NULL;

-- 4) Backfill Product.categoryId using the seeded Category ids
UPDATE "public"."Product" p
SET "categoryId" = md5(lower(p."category"))
WHERE p."categoryId" IS NULL;

-- 5) Add FK and index, make categoryId NOT NULL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'Product'
      AND constraint_name = 'Product_categoryId_fkey'
  ) THEN
    ALTER TABLE "public"."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Product_categoryId_idx'
  ) THEN
    CREATE INDEX "Product_categoryId_idx" ON "public"."Product"("categoryId");
  END IF;
END $$;

ALTER TABLE "public"."Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- 6) Drop old Product.category column if exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product' AND column_name = 'category'
  ) THEN
    ALTER TABLE "public"."Product" DROP COLUMN "category";
  END IF;
END $$;

COMMIT;


