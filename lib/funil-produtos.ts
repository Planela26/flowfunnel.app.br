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
/**
 * Os `leadId` que chegaram por algum dos links rastreáveis deste funil.
 *
 * O elo existe porque cada clique no link curto grava um evento `link_click`
 * com `metadata.siteId` (ver lib/tracking-link.ts). Como o dado já está lá, o
 * vínculo vale RETROATIVAMENTE: escolher um link reorganiza o histórico na
 * hora, sem reprocessar nada.
 *
 * Devolve `null` quando não há filtro a aplicar — funil sem link vinculado —
 * e nesse caso quem chama mostra tudo, como antes desta coluna existir.
 *
 * Devolve lista VAZIA quando há vínculo mas nenhum visitante passou por ele.
 * A diferença importa: vazio é uma medição ("ninguém veio ainda"), null é a
 * ausência de pergunta.
 */
export async function leadsDoFunil(
  workspaceId: string | null | undefined,
  userId: string,
  desde?: Date,
): Promise<string[] | null> {
  if (!workspaceId) return null
  try {
    const ws = await prismaAdmin.workspace.findFirst({
      where: { id: workspaceId, userId },
      select: { trackedSiteIds: true },
    })
    if (!ws?.trackedSiteIds) return null
    const sites = JSON.parse(ws.trackedSiteIds) as string[]
    if (!Array.isArray(sites) || sites.length === 0) return null

    // `metadata.siteId` vive dentro do JSON, então a busca é por conteúdo. O id
    // é um cuid — colisão com outro trecho do metadata é improvável o bastante
    // para não justificar uma coluna nova e a migração de dados que ela pediria.
    const eventos = await prismaAdmin.trackedEvent.findMany({
      where: {
        userId,
        eventName: 'link_click',
        ...(desde ? { createdAt: { gte: desde } } : {}),
        OR: sites.map((id) => ({ metadata: { contains: id } })),
      },
      select: { leadId: true },
      take: 20_000,
    })
    return [...new Set(eventos.map((e) => e.leadId))]
  } catch (e) {
    // Vínculo ilegível não pode esconder visitante: sem filtro é o padrão seguro.
    console.error(`[funil-produtos] links do funil ${workspaceId} ilegíveis; seguindo SEM filtro:`, e)
    return null
  }
}

/**
 * As transações que pertencem a este funil, pela ATRIBUIÇÃO.
 *
 * A corrente já existia inteira e ninguém a estava usando:
 *
 *   funil → link rastreável → visitante (leadId)
 *        → SaleAttribution.leadId → transactionId → a venda
 *
 * O `sck` que o tracker injeta no link do checkout volta no webhook, e
 * `attributeSale()` grava a venda amarrada ao lead. Quer dizer que uma compra
 * feita por quem clicou no link do funil 1 JÁ SABE que é do funil 1 — sem
 * ninguém colar ID de produto em lugar nenhum.
 *
 * É por isso que esta função existe: vincular produto à mão funciona, mas
 * exige que a pessoa saiba o ID e lembre de preencher em cada funil. Aqui a
 * separação sai de graça de algo que ela já fez — marcar o link.
 *
 * `null` = sem como atribuir (funil sem link), e quem chama não filtra.
 * Lista vazia = há link, mas nenhuma venda veio por ele. São diferentes.
 */
export async function vendasDoFunil(
  workspaceId: string | null | undefined,
  userId: string,
  plataforma: string,
): Promise<string[] | null> {
  // Sem recorte de data aqui de propósito: a venda pode acontecer semanas
  // depois da visita, e o corte por período é aplicado no evento, não na
  // atribuição. Limitar aqui esconderia venda legítima de visitante antigo.
  const leads = await leadsDoFunil(workspaceId, userId)
  if (leads === null) return null
  if (leads.length === 0) return []

  const atribuicoes = await prismaAdmin.saleAttribution.findMany({
    where: { userId, platform: plataforma, leadId: { in: leads } },
    select: { transactionId: true },
    take: 20_000,
  })
  return [...new Set(atribuicoes.map((a) => a.transactionId))]
}

export function eventoDoFunil(meta: any, produtos: string[] | null): boolean {
  if (!produtos) return true
  const id = meta?.productId ?? meta?.product_id ?? meta?.produto_id
  if (id == null) return false
  return produtos.includes(String(id))
}
