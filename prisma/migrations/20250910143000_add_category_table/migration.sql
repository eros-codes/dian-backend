-- Create Category table and migrate Product.category -> Product.categoryId
-- This migration assumes existing "public"."Product" table with a TEXT column "category".

BEGIN;

-- 1) Create Category table
CREATE TABLE "public"."Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- 2) Unique constraint on name
CREATE UNIQUE INDEX "Category_name_key" ON "public"."Category"("name");

-- 3) Add nullable categoryId to Product
ALTER TABLE "public"."Product" ADD COLUMN "categoryId" TEXT;

-- 4) Seed Category from distinct Product.category values
INSERT INTO "public"."Category" ("id", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT md5(lower(p."category")) AS id,
       p."category" AS name,
       NULL::TEXT AS description,
       TRUE AS isActive,
       NOW() AS createdAt,
       NOW() AS updatedAt
FROM "public"."Product" p
WHERE p."category" IS NOT NULL AND p."category" <> '';

-- 5) Backfill Product.categoryId
UPDATE "public"."Product" p
SET "categoryId" = md5(lower(p."category"))
WHERE p."category" IS NOT NULL AND p."category" <> '';

-- 6) Add FK and index
ALTER TABLE "public"."Product"
  ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Product_categoryId_idx" ON "public"."Product"("categoryId");

-- 7) Make categoryId NOT NULL
ALTER TABLE "public"."Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- 8) Drop old column
ALTER TABLE "public"."Product" DROP COLUMN "category";

COMMIT;


