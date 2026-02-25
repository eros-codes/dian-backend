-- Migration: add BREAKFAST value to CategoryType enum
-- Run with: npx prisma migrate deploy (or apply this SQL on the DB)

BEGIN;

-- Add new enum value to CategoryType used by Prisma schema
ALTER TYPE "CategoryType" ADD VALUE IF NOT EXISTS 'BREAKFAST';

COMMIT;
