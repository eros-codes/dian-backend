/*
  Warnings:

  - You are about to drop the `email_verifications` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

-- DropTable
DROP TABLE "public"."email_verifications";
