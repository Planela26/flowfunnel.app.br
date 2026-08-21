-- Layout do FunnelFlow por FUNIL, em vez de por conta.
--
-- `User.funnelLayout` e `User.funnelVisibleIds` guardavam UM arranjo por
-- usuário. Como cada "funil" da interface é um Workspace, e todos liam o mesmo
-- campo, arrastar um card num funil movia o card do outro, e esconder um card
-- escondia nos dois. Não havia como manter arranjos diferentes.
--
-- Colunas anuláveis e sem default: `NULL` significa "este funil ainda não tem
-- arranjo próprio", e a leitura cai no valor do usuário. Isso preserva o que
-- as contas existentes já organizaram — ninguém abre o painel e encontra os
-- cards embaralhados. A partir do primeiro arraste, cada funil passa a ter o
-- seu, e o campo do usuário vira apenas o ponto de partida.
--
-- As colunas do User permanecem de propósito: são o fallback dos funis que
-- ainda não divergiram.

ALTER TABLE "Workspace" ADD COLUMN "funnelLayout" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "funnelVisibleIds" TEXT;
