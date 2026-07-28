-- CreateTable: SaraMemory
CREATE TABLE "SaraMemory" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "context"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaraMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaraMemory_userId_idx" ON "SaraMemory"("userId");
CREATE INDEX "SaraMemory_type_idx"   ON "SaraMemory"("type");

-- CreateTable: SaraInsight
CREATE TABLE "SaraInsight" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity"    TEXT NOT NULL DEFAULT 'info',
    "isRead"      BOOLEAN NOT NULL DEFAULT false,
    "data"        TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaraInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaraInsight_userId_idx"    ON "SaraInsight"("userId");
CREATE INDEX "SaraInsight_isRead_idx"    ON "SaraInsight"("isRead");
CREATE INDEX "SaraInsight_createdAt_idx" ON "SaraInsight"("createdAt");
CREATE INDEX "SaraInsight_severity_idx"  ON "SaraInsight"("severity");
