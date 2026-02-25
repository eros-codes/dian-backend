-- CreateTable
CREATE TABLE "public"."SalesSnapshot" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesSnapshot_adminId_idx" ON "public"."SalesSnapshot"("adminId");
