-- CreateTable: AILog
CREATE TABLE "AILog" (
    "id"            TEXT NOT NULL,
    "ticketId"      TEXT,
    "userId"        TEXT,
    "action"        TEXT NOT NULL,
    "model"         TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "promptTokens"  INTEGER NOT NULL DEFAULT 0,
    "completTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens"   INTEGER NOT NULL DEFAULT 0,
    "durationMs"    INTEGER NOT NULL DEFAULT 0,
    "costUsd"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accepted"      BOOLEAN,
    "category"      TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AILog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AILog_ticketId_idx"  ON "AILog"("ticketId");
CREATE INDEX "AILog_userId_idx"    ON "AILog"("userId");
CREATE INDEX "AILog_createdAt_idx" ON "AILog"("createdAt");
CREATE INDEX "AILog_action_idx"    ON "AILog"("action");

-- AlterTable: KnowledgeArticle — add version + authorId
ALTER TABLE "KnowledgeArticle"
    ADD COLUMN "version"  TEXT,
    ADD COLUMN "authorId" TEXT;
