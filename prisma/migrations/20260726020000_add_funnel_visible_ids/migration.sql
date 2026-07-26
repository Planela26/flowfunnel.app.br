-- AlterTable: persiste quais cards do FunnelFlow estão visíveis para o usuário.
-- Antes só salvávamos posições; agora também guardamos a lista de IDs visíveis,
-- então apagar um card (X no card) fica gravado para sempre.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "funnelVisibleIds" TEXT;
