-- Posições dos cards do FunnelFlow (JSON) — sincroniza layout entre navegadores/dispositivos
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "funnelLayout" TEXT;
