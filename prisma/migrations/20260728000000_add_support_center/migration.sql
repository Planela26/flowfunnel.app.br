-- CreateTable: SupportTicket
CREATE TABLE "SupportTicket" (
    "id"              TEXT NOT NULL,
    "number"          SERIAL NOT NULL,
    "userId"          TEXT NOT NULL,
    "assigneeId"      TEXT,
    "subject"         TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "type"            TEXT NOT NULL DEFAULT 'question',
    "priority"        TEXT NOT NULL DEFAULT 'medium',
    "status"          TEXT NOT NULL DEFAULT 'new',
    "aiSummary"       TEXT,
    "tags"            TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt"      TIMESTAMP(3),
    "closedAt"        TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");
CREATE INDEX "SupportTicket_userId_idx"    ON "SupportTicket"("userId");
CREATE INDEX "SupportTicket_status_idx"    ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_priority_idx"  ON "SupportTicket"("priority");
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

ALTER TABLE "SupportTicket"
    ADD CONSTRAINT "SupportTicket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SupportMessage
CREATE TABLE "SupportMessage" (
    "id"         TEXT NOT NULL,
    "ticketId"   TEXT NOT NULL,
    "senderId"   TEXT,
    "senderType" TEXT NOT NULL DEFAULT 'user',
    "content"    TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");

ALTER TABLE "SupportMessage"
    ADD CONSTRAINT "SupportMessage_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SupportAttachment
CREATE TABLE "SupportAttachment" (
    "id"        TEXT NOT NULL,
    "ticketId"  TEXT NOT NULL,
    "messageId" TEXT,
    "name"      TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "size"      INTEGER,
    "mimeType"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportAttachment_ticketId_idx" ON "SupportAttachment"("ticketId");

ALTER TABLE "SupportAttachment"
    ADD CONSTRAINT "SupportAttachment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAttachment"
    ADD CONSTRAINT "SupportAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "SupportMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: SupportInternalNote
CREATE TABLE "SupportInternalNote" (
    "id"        TEXT NOT NULL,
    "ticketId"  TEXT NOT NULL,
    "authorId"  TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportInternalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportInternalNote_ticketId_idx" ON "SupportInternalNote"("ticketId");

ALTER TABLE "SupportInternalNote"
    ADD CONSTRAINT "SupportInternalNote_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SupportHistory
CREATE TABLE "SupportHistory" (
    "id"        TEXT NOT NULL,
    "ticketId"  TEXT NOT NULL,
    "actorId"   TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "action"    TEXT NOT NULL,
    "from"      TEXT,
    "to"        TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportHistory_ticketId_idx" ON "SupportHistory"("ticketId");

ALTER TABLE "SupportHistory"
    ADD CONSTRAINT "SupportHistory_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: KnowledgeArticle
CREATE TABLE "KnowledgeArticle" (
    "id"        TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "category"  TEXT NOT NULL,
    "tags"      TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeArticle_category_idx" ON "KnowledgeArticle"("category");
