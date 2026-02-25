/*
  Warnings:

  - Made the column `publicId` on table `ProductImage` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."ProductImage" ALTER COLUMN "publicId" SET NOT NULL,
ALTER COLUMN "publicId" SET DEFAULT '';
