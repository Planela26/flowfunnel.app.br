/**
 * Quais produtos de checkout cada funil acompanha.
 *
 * O problema que isto resolve: as rotas de métrica de checkout consultavam por
 * `userId` e nada mais. Criar um funil novo trazia junto o faturamento de todos
 * os outros — dois funis na tela, os mesmos números nos dois. WhatsApp e
 * Facebook já se separavam por `whatsappIntegrationId` e `facebookCampaignId`;
 * o checkout era a peça que faltava do mesmo desenho.
 *
 * A separação é por PRODUTO porque é o identificador que já chega em toda venda
 * (`data.product.id` da Hotmart, gravado em `metadata.productId`). Sendo um dado
 * que já existe, o filtro vale também para as vendas ANTIGAS: vincular um
 * produto reorganiza o histórico na hora, sem precisar reprocessar nada.
 */

import { prismaAdmin } from './prisma'

/** {"hotmart":["8365536"],"kiwify":["abc"]} */
export type ProdutosPorPlataforma = Record<string, string[]>

/**
 * Lê o vínculo de um funil. Devolve `null` quando não há filtro a aplicar —
 * funil sem vínculo, plataforma não listada, ou lista vazia. `null` significa
 * "mostre tudo", que é o comportamento de antes desta coluna existir e o que
 * mantém os funis já criados intactos.
 */
export async function produtosDoFunil(
  workspaceId: string | null | undefined,
  plataforma: string,
  userId: string,
): Promise<string[] | null> {
  if (!workspaceId) return null
  try {
    const ws = await prismaAdmin.workspace.findFirst({
      // `userId` no filtro, não só o id: sem isso, um workspaceId de outra conta
      // passado na query string leria o vínculo alheio.
      where: { id: workspaceId, userId },
      select: { checkoutProductIds: true },
    })
    if (!ws?.checkoutProductIds) return null
    const mapa = JSON.parse(ws.checkoutProductIds) as ProdutosPorPlataforma
    const ids = mapa?.[plataforma]
    if (!Array.isArray(ids) || ids.length === 0) return null
    return ids.map(String)
  } catch {
    // Vínculo ilegível não pode esconder venda: sem filtro é o padrão seguro.
    console.error(`[funil-produtos] vínculo ilegível no funil ${workspaceId}; seguindo SEM filtro.`)
    return null
  }
}

/**
 * O evento pertence a este funil?
 *
 * `produtos === null` aceita tudo. Com lista, compara o `productId` gravado no
 * metadata — como texto dos dois lados, porque a Hotmart manda número e o
 * vínculo guarda string.
 */
export function eventoDoFunil(meta: any, produtos: string[] | null): boolean {
  if (!produtos) return true
  const id = meta?.productId ?? meta?.product_id ?? meta?.produto_id
  if (id == null) return false
  return produtos.includes(String(id))
}
