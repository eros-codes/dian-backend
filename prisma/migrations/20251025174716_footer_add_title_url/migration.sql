/*
  Warnings:

  - You are about to drop the column `is_link` on the `FooterSetting` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `FooterSetting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FooterSetting" DROP COLUMN "is_link",
DROP COLUMN "value",
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "url" TEXT;
