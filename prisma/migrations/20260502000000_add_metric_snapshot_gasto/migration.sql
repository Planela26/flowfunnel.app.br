-- AlterTable: add gasto column to MetricSnapshot.
-- Idempotent (IF NOT EXISTS) so it can safely be applied to environments
-- that may already contain the column (e.g. dev/staging where the schema
-- was previously applied via `prisma db push`).
ALTER TABLE "MetricSnapshot" ADD COLUMN IF NOT EXISTS "gasto" DOUBLE PRECISION NOT NULL DEFAULT 0;
