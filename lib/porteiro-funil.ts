/**
 * O PORTEIRO — decide de qual funil é o dado, na hora em que ele chega.
 *
 * O problema que isto resolve: o dado chegava e ia todo para o mesmo balde. A
 * pergunta "de qual funil é isto?" era refeita a CADA leitura, por cada rota,
 * com o filtro que ela lembrasse de aplicar — e as que não lembravam mostravam
 * a conta inteira. Dois funis na tela, os mesmos números nos dois.
 *
 * Aqui a pergunta é respondida UMA vez, na porta, e o evento entra carimbado
 * (`FunnelEvent.workspaceId`). Toda tela herda a resposta sem precisar saber
 * como ela foi obtida.
 *
 * O crachá é o ID DO PRODUTO. Ele já vem em toda venda da Hotmart
 * (`data.product.id`), e é o que a pessoa cadastra no card do funil. Um produto
 * pertence a UM funil só — a exclusividade é garantida na hora de salvar o
 * vínculo (app/api/workspaces), não aqui.
 *
 * Quando nenhum funil reivindica o produto, devolve `null`: o "Sem funil".
 * Não é erro nem descarte — é um lugar visível, para venda nenhuma sumir em
 * silêncio.
 *
 * Por ora só a Hotmart usa o porteiro. As outras plataformas continuam como
 * estavam; quando entrarem, entram por aqui.
 */

import { prismaAdmin } from './prisma'

/** {"hotmart":["8365536"],"kiwify":["abc"]} — como o vínculo é guardado. */
type ProdutosPorPlataforma = Record<string, string[]>

/**
 * Normaliza um id de produto para comparação.
 *
 * A Hotmart manda número no webhook (`8365536`) e o vínculo guarda o que a
 * pessoa digitou, que pode vir com espaço sobrando. Sem normalizar os dois
 * lados, `" 8365536"` nunca casaria com `8365536` e a venda cairia em "Sem
 * funil" sem nenhum motivo visível.
 */
export function normalizarIdProduto(bruto: unknown): string | null {
  if (bruto == null) return null
  const s = String(bruto).trim()
  return s === '' ? null : s
}

/**
 * Mapa `id do produto → funil`, montado a partir dos vínculos da conta.
 *
 * Lê todos os funis de uma vez porque o webhook chega um por venda e não vale
 * uma consulta por funil. Em caso de id repetido em dois funis — que a
 * validação do cadastro impede, mas dado antigo pode ter — o PRIMEIRO
 * cadastrado vence, e o conflito é registrado no log para poder ser corrigido.
 */
export async function mapaDeProdutos(
  userId: string,
  plataforma: string,
): Promise<Map<string, string>> {
  const funis = await prismaAdmin.workspace.findMany({
    where: { userId },
    select: { id: true, checkoutProductIds: true },
    orderBy: { createdAt: 'asc' },
  })
  return montarMapaDeProdutos(funis, plataforma)
}

/**
 * A REGRA do mapa, separada da busca no banco para poder ser testada sozinha.
 *
 * Recebe os funis JÁ lidos, em ordem de criação — a ordem é o critério de
 * desempate quando o mesmo id aparece em dois funis.
 */
export function montarMapaDeProdutos(
  funis: { id: string; checkoutProductIds: string | null }[],
  plataforma: string,
): Map<string, string> {
  const mapa = new Map<string, string>()

  for (const funil of funis) {
    if (!funil.checkoutProductIds) continue
    let vinculo: ProdutosPorPlataforma
    try {
      vinculo = JSON.parse(funil.checkoutProductIds) as ProdutosPorPlataforma
    } catch {
      // Vínculo ilegível não pode derrubar a ingestão: a venda entra sem
      // carimbo e fica visível em "Sem funil", que é recuperável.
      console.error(`[porteiro] vínculo ilegível no funil ${funil.id}; ignorado.`)
      continue
    }

    const ids = vinculo?.[plataforma]
    if (!Array.isArray(ids)) continue

    for (const bruto of ids) {
      const id = normalizarIdProduto(bruto)
      if (!id) continue
      const dono = mapa.get(id)
      if (dono && dono !== funil.id) {
        console.warn(
          `[porteiro] produto ${id} (${plataforma}) está em dois funis: ` +
          `${dono} e ${funil.id}. Mantendo o primeiro.`,
        )
        continue
      }
      mapa.set(id, funil.id)
    }
  }

  return mapa
}

/**
 * De qual funil é esta venda?
 *
 * `null` = nenhum funil reivindicou este produto (ou a venda chegou sem id de
 * produto). Quem chama grava `workspaceId: null` — o "Sem funil".
 */
export async function funilDoProduto(
  userId: string,
  plataforma: string,
  idProduto: unknown,
): Promise<string | null> {
  const id = normalizarIdProduto(idProduto)
  if (!id) return null
  const mapa = await mapaDeProdutos(userId, plataforma)
  return mapa.get(id) ?? null
}

/**
 * O funil de uma venda da Hotmart, direto do payload.
 *
 * `product.id` é o campo oficial; `product.ucode` é o identificador alternativo
 * que a Hotmart manda em alguns eventos. Aceitar os dois evita que a mesma
 * oferta caia em "Sem funil" só porque o evento veio com o outro campo.
 */
export async function funilDaVendaHotmart(
  userId: string,
  produto: { id?: number | string | null; ucode?: string | null } | null | undefined,
): Promise<string | null> {
  const porId = await funilDoProduto(userId, 'hotmart', produto?.id)
  if (porId) return porId
  return funilDoProduto(userId, 'hotmart', produto?.ucode)
}

/**
 * Avisa que chegou venda de um produto que não está em funil nenhum.
 *
 * Sem este aviso, o "Sem funil" seria um buraco silencioso: a venda entra, não
 * aparece em funil algum, e a pessoa só descobre quando estranha o faturamento.
 * Com ele, a falta de vínculo é uma notificação com o id pronto para cadastrar.
 *
 * Um aviso por produto a cada 24h — a mesma oferta vende muitas vezes por dia,
 * e um aviso por venda viraria ruído que ninguém lê.
 */
export async function avisarProdutoSemFunil(
  userId: string,
  plataforma: string,
  idProduto: unknown,
  nomeProduto?: string | null,
) {
  const id = normalizarIdProduto(idProduto)
  if (!id) return

  try {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const jaAvisado = await prismaAdmin.notification.findFirst({
      where: {
        userId,
        type: 'produto_sem_funil',
        message: { contains: id },
        createdAt: { gte: ontem },
      },
      select: { id: true },
    })
    if (jaAvisado) return

    const nome = nomeProduto ? `"${nomeProduto}" ` : ''
    await prismaAdmin.notification.create({
      data: {
        userId,
        type: 'produto_sem_funil',
        title: 'Venda sem funil',
        message:
          `Chegou uma venda do produto ${nome}(id ${id}, ${plataforma}) que não está ` +
          `vinculado a nenhum funil. Ela está em "Sem funil" até você vincular o id.`,
        link: '/dashboard',
      },
    })
  } catch (e) {
    // Aviso é secundário: nunca pode derrubar a ingestão da venda.
    console.error('[porteiro] falha ao avisar produto sem funil:', e)
  }
}

/**
 * Passa o porteiro de novo sobre o histórico já gravado.
 *
 * É isto que mantém a melhor propriedade do desenho antigo: o vínculo vale
 * PARA TRÁS. Cadastrar o id de um produto hoje reorganiza as vendas antigas
 * dele na hora, sem reprocessar webhook nenhum — o id já está gravado no
 * metadata de cada evento desde que ele chegou.
 *
 * Roda sozinha sempre que o vínculo de produtos de um funil muda, e também
 * pelo botão "reorganizar". Reexecutar é seguro: o cálculo é o mesmo e o
 * resultado converge.
 *
 * `null` no fim não é falha: é o "Sem funil" — evento cujo produto não está em
 * funil nenhum. Por isso os que DEIXARAM de ter dono também são atualizados:
 * remover um id de um funil precisa tirar de lá as vendas daquele produto.
 */
export async function reorganizarHistoricoHotmart(userId: string): Promise<{
  atualizados: number
  semFunil: number
}> {
  const funis = await prismaAdmin.funnel.findMany({
    where: { userId },
    select: { id: true },
  })
  const funnelIds = funis.map((f) => f.id)
  if (funnelIds.length === 0) return { atualizados: 0, semFunil: 0 }

  const mapa = await mapaDeProdutos(userId, 'hotmart')

  const eventos = await prismaAdmin.funnelEvent.findMany({
    where: { funnelId: { in: funnelIds }, source: 'hotmart' },
    select: { id: true, metadata: true, workspaceId: true },
    take: 50_000,
  })

  // Agrupa por destino e grava em lote: um update por funil, em vez de um por
  // venda. Uma conta com 20 mil vendas tomaria minutos do jeito ingênuo.
  const porDestino = new Map<string | null, string[]>()

  for (const ev of eventos) {
    let meta: any = {}
    try {
      meta = typeof ev.metadata === 'string' ? JSON.parse(ev.metadata) : ev.metadata || {}
    } catch {
      meta = {}
    }
    const id = normalizarIdProduto(meta?.productId ?? meta?.product_id ?? meta?.produto_id)
    const destino = id ? mapa.get(id) ?? null : null
    if (destino === ev.workspaceId) continue // já está no lugar certo
    const lista = porDestino.get(destino) ?? []
    lista.push(ev.id)
    porDestino.set(destino, lista)
  }

  let atualizados = 0
  let semFunil = 0
  for (const [destino, ids] of porDestino) {
    for (let i = 0; i < ids.length; i += 1000) {
      const lote = ids.slice(i, i + 1000)
      await prismaAdmin.funnelEvent.updateMany({
        where: { id: { in: lote } },
        data: { workspaceId: destino },
      })
      atualizados += lote.length
      if (destino === null) semFunil += lote.length
    }
  }

  return { atualizados, semFunil }
}
