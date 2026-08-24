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
 * A URL sem query string e sem barra final, para servir de prefixo de busca.
 *
 * `https://site.com/pagina/?utm_source=fb` e `https://site.com/pagina` são a
 * mesma página. Comparar as duas por igualdade exata deixaria de fora
 * justamente o tráfego de anúncio, que nunca chega sem parâmetro.
 *
 * Devolve `null` para URL inválida — melhor não filtrar do que filtrar por um
 * prefixo lixo, que casaria com nada e zeraria o card em silêncio.
 */
function normalizarUrl(bruta: string | null | undefined): string | null {
  if (!bruta) return null
  try {
    const u = new URL(bruta)
    const caminho = u.pathname.replace(/\/+$/, '')
    return `${u.origin}${caminho}`
  } catch {
    return null
  }
}

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
    const ids = JSON.parse(ws.trackedSiteIds) as string[]
    if (!Array.isArray(ids) || ids.length === 0) return null

    const sites = await prismaAdmin.trackedSite.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, destinationUrl: true },
    })
    if (sites.length === 0) return null

    const encontrados = new Set<string>()

    // CAMINHO 1 — quem passou pelo link encurtado. `metadata.siteId` vive
    // dentro do JSON, então a busca é por conteúdo; o id é um cuid, e colisão
    // com outro trecho do metadata é improvável o bastante para não justificar
    // uma coluna nova.
    const eventos = await prismaAdmin.trackedEvent.findMany({
      where: {
        userId,
        eventName: 'link_click',
        ...(desde ? { createdAt: { gte: desde } } : {}),
        OR: ids.map((id) => ({ metadata: { contains: id } })),
      },
      select: { leadId: true },
      take: 20_000,
    })
    for (const e of eventos) encontrados.add(e.leadId)

    // CAMINHO 2 — quem chegou pela URL cadastrada, SEM encurtador.
    //
    // Quem usa o próprio domínio e instala o rastreador na página não passa por
    // /r/<slug>, então não gera `link_click` e ficaria de fora do caminho 1.
    // Mas `firstUrl` é gravado nos dois casos e aponta para a MESMA página — no
    // link encurtado é o destino, na visita direta é a própria URL. Casar por
    // ela cobre os dois sem exigir encurtador de ninguém.
    //
    // A comparação ignora query string: o mesmo endereço com ?utm_source=... é
    // a mesma página, e exigir igualdade exata deixaria de fora justamente o
    // tráfego de anúncio, que sempre carrega parâmetros.
    const prefixos = sites
      .map((s) => normalizarUrl(s.destinationUrl))
      .filter((u): u is string => Boolean(u))

    if (prefixos.length > 0) {
      const porUrl = await prismaAdmin.trackedLead.findMany({
        where: {
          userId,
          ...(desde ? { createdAt: { gte: desde } } : {}),
          OR: prefixos.map((p) => ({ firstUrl: { startsWith: p } })),
        },
        select: { leadId: true },
        take: 20_000,
      })
      for (const l of porUrl) encontrados.add(l.leadId)
    }

    return [...encontrados]
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
