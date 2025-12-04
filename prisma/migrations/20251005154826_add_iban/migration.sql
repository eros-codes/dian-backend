-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "iban" VARCHAR(26),
ALTER COLUMN "role" DROP DEFAULT;
