-- Migration: make_banner_title_optional
-- Drop NOT NULL constraint on Banner.title
ALTER TABLE "Banner" ALTER COLUMN "title" DROP NOT NULL;
