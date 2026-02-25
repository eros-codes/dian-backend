-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "staticId" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "seats" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tables_staticId_key" ON "tables"("staticId");

-- AddForeignKey
ALTER TABLE "table_session_logs" ADD CONSTRAINT "table_session_logs_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("staticId") ON DELETE SET NULL ON UPDATE CASCADE;
