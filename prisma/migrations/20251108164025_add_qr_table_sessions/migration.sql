-- CreateEnum
CREATE TYPE "SessionAction" AS ENUM ('issue', 'consume');

-- CreateTable
CREATE TABLE "table_session_logs" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(32) NOT NULL,
    "tableId" VARCHAR(32) NOT NULL,
    "action" "SessionAction" NOT NULL,
    "ip" VARCHAR(64) NOT NULL,
    "userAgent" TEXT NOT NULL,
    "result" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "table_session_logs_tableId_idx" ON "table_session_logs"("tableId");

-- CreateIndex
CREATE INDEX "table_session_logs_createdAt_idx" ON "table_session_logs"("createdAt");

-- CreateIndex
CREATE INDEX "table_session_logs_action_result_idx" ON "table_session_logs"("action", "result");
