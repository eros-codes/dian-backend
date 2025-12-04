-- AlterTable
ALTER TABLE "public"."ProductImage" ALTER COLUMN "publicId" DROP NOT NULL,
ALTER COLUMN "publicId" SET DATA TYPE TEXT;
