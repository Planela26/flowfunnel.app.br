import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { canAccessOwnerFunnel, getOwnerUserId, DEGRAUS } from '@/lib/owner-funnel'
import { compararIndicador, encontrarGargalo } from '@/lib/owner-metrics'

/**
 * Funil em degraus do laboratório — anúncio → LP → CTA → checkout → pagamento
 * → compra, com as taxas entre cada etapa.
 *
 * Autorização real, não só menu escondido: `canAccessOwnerFunnel` confere
 * role E identidade da conta. Um segundo ADMIN (ex.: suporte) recebe 403 —
 * administrar clientes não dá acesso aos números de marketing do negócio.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const autorizado = await canAccessOwnerFunnel(session?.user as any)
  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) return NextResponse.json({ error: 'Conta do laboratório não configurada' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const dias = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365)
  const MS_DIA = 24 * 60 * 60 * 1000
  const desde = new Date(Date.now() - dias * MS_DIA)
  // Período anterior de MESMA duração, imediatamente antes — é a comparação
  // que responde "melhorou ou piorou?". Comparar contra um intervalo de
  // tamanho diferente inflaria ou desinflaria tudo por construção.
  const desdeAnterior = new Date(Date.now() - dias * 2 * MS_DIA)
  const ateAnterior = desde

  const [eventosPorNome, conversoes, porOrigem, porCampanha, porAd] = await Promise.all([
    // Pares (evento, pessoa) sem repetição. O funil conta PESSOAS, não
    // disparos — ver `pessoasNoDegrau` abaixo para o porquê.
    prisma.trackedEvent.findMany({
      where: { userId: ownerId, createdAt: { gte: desde } },
      select: { eventName: true, leadId: true },
      distinct: ['eventName', 'leadId'],
    }),
    prisma.saleAttribution.aggregate({
      where: { userId: ownerId, createdAt: { gte: desde } },
      _count: { _all: true },
      _sum: { value: true },
    }),
    prisma.trackedLead.groupBy({
      by: ['utmSource'],
      where: { userId: ownerId, createdAt: { gte: desde } },
      _count: { _all: true },
    }),
    prisma.saleAttribution.groupBy({
      by: ['utmCampaign'],
      where: { userId: ownerId, createdAt: { gte: desde }, utmCampaign: { not: null } },
      _count: { _all: true },
      _sum: { value: true },
    }),
    // "Qual anúncio vendeu" olha o METADATA da atribuição (onde o adId fica
    // congelado no momento da venda), não TrackedLead: o objetivo aqui é
    // receita por criativo, e só a atribuição sabe o valor da venda.
    prisma.saleAttribution.findMany({
      where: { userId: ownerId, createdAt: { gte: desde } },
      select: { metadata: true, value: true },
    }),
  ])

  // Período anterior, para a comparação.
  const [eventosAnteriores, conversoesAnteriores] = await Promise.all([
    prisma.trackedEvent.findMany({
      where: { userId: ownerId, createdAt: { gte: desdeAnterior, lt: ateAnterior } },
      select: { eventName: true, leadId: true },
      distinct: ['eventName', 'leadId'],
    }),
    prisma.saleAttribution.aggregate({
      where: { userId: ownerId, createdAt: { gte: desdeAnterior, lt: ateAnterior } },
      _count: { _all: true },
      _sum: { value: true },
    }),
  ])

  /**
   * Quantas PESSOAS distintas alcançaram um degrau.
   *
   * Contar eventos distorce em dois lugares. `engajamento` reúne scroll_50,
   * 60, 75 e 90: quem lê a página até o fim dispara os quatro, então uma
   * pessoa virava quatro. E recarregar a página soma um page_view novo, então
   * a mesma visita contava várias vezes no topo — justamente o degrau que é
   * denominador de todas as taxas.
   *
   * Contando pessoas, o número passa a ser comparável ao que a Meta reporta
   * como clique no link, que também é por pessoa.
   */
  const pessoasPorEvento = (pares: Array<{ eventName: string; leadId: string }>) => {
    const m = new Map<string, Set<string>>()
    for (const p of pares) {
      let s = m.get(p.eventName)
      if (!s) { s = new Set(); m.set(p.eventName, s) }
      s.add(p.leadId)
    }
    return m
  }

  const pessoasNoDegrau = (m: Map<string, Set<string>>, eventos: string[]) => {
    // União, não soma: quem disparou scroll_50 E scroll_90 é uma pessoa só.
    const uniao = new Set<string>()
    for (const ev of eventos) for (const lead of m.get(ev) ?? []) uniao.add(lead)
    return uniao.size
  }

  const pessoas = pessoasPorEvento(eventosPorNome)

  const passos = DEGRAUS.map(d => ({
    chave: d.chave,
    rotulo: d.rotulo,
    total: pessoasNoDegrau(pessoas, d.eventos),
  }))
  // Compras vem de SaleAttribution, não de TrackedEvent: é a fonte que também
  // carrega o valor, e as duas devem coincidir em contagem (o webhook grava
  // os dois juntos).
  const idxCompras = passos.findIndex(p => p.chave === 'compras')
  if (idxCompras >= 0) passos[idxCompras].total = conversoes._count._all

  const taxas = passos.map((p, i) => {
    if (i === 0) return { ...p, taxaDoAnterior: null as string | null }
    const anterior = passos[i - 1].total
    const taxa = anterior > 0 ? `${((p.total / anterior) * 100).toFixed(1)}%` : '—'
    return { ...p, taxaDoAnterior: taxa }
  })

  const receita = conversoes._sum.value || 0
  const ticketMedio = conversoes._count._all > 0 ? receita / conversoes._count._all : 0
  const taxaFinal = passos[0]?.total > 0 ? `${((conversoes._count._all / passos[0].total) * 100).toFixed(2)}%` : '—'

  const NOMES_ORIGEM: Record<string, string> = {
    facebook: 'Meta Ads', fb: 'Meta Ads', meta: 'Meta Ads', instagram: 'Meta Ads',
    google: 'Google Ads', adwords: 'Google Ads',
    tiktok: 'TikTok Ads', bing: 'Microsoft Ads', microsoft: 'Microsoft Ads',
  }
  const origens = porOrigem
    .map(o => {
      const bruto = (o.utmSource || '').toLowerCase().trim()
      const nome = !bruto ? 'Direto' : (NOMES_ORIGEM[bruto] || o.utmSource || 'Outros')
      return { nome, visitas: o._count._all }
    })
    .reduce((acc: Array<{ nome: string; visitas: number }>, cur) => {
      const existente = acc.find(a => a.nome === cur.nome)
      if (existente) existente.visitas += cur.visitas
      else acc.push(cur)
      return acc
    }, [])
    .sort((a, b) => b.visitas - a.visitas)

  const campanhas = porCampanha
    .map(c => ({ nome: c.utmCampaign || '—', vendas: c._count._all, receita: c._sum.value || 0 }))
    .sort((a, b) => b.receita - a.receita)

  const porAdId: Record<string, { vendas: number; receita: number }> = {}
  for (const a of porAd) {
    let adId: string | null = null
    try { adId = a.metadata ? JSON.parse(a.metadata).adId : null } catch { /* ignore */ }
    const chave = adId || 'Sem identificação'
    if (!porAdId[chave]) porAdId[chave] = { vendas: 0, receita: 0 }
    porAdId[chave].vendas += 1
    porAdId[chave].receita += a.value
  }
  const anuncios = Object.entries(porAdId)
    .map(([adId, v]) => ({ adId, ...v }))
    .sort((a, b) => b.receita - a.receita)

  // ── Comparação com o período anterior ─────────────────────────────────────
  const pessoasAnteriores = pessoasPorEvento(eventosAnteriores)

  const degrau = (m: Map<string, Set<string>>, chave: string) => {
    const d = DEGRAUS.find(x => x.chave === chave)
    return d ? pessoasNoDegrau(m, d.eventos) : 0
  }

  const receitaAnterior = conversoesAnteriores._sum.value || 0
  const vendasAnteriores = conversoesAnteriores._count._all

  const comparacao = {
    diasComparados: dias,
    visitas: compararIndicador(degrau(pessoas, 'visitas'), degrau(pessoasAnteriores, 'visitas')),
    cta: compararIndicador(degrau(pessoas, 'cta'), degrau(pessoasAnteriores, 'cta')),
    checkout: compararIndicador(degrau(pessoas, 'checkout'), degrau(pessoasAnteriores, 'checkout')),
    vendas: compararIndicador(conversoes._count._all, vendasAnteriores),
    receita: compararIndicador(receita, receitaAnterior),
    ticketMedio: compararIndicador(
      ticketMedio,
      vendasAnteriores > 0 ? receitaAnterior / vendasAnteriores : 0,
    ),
  }

  const gargalo = encontrarGargalo(passos)

  return NextResponse.json({
    periodoDias: dias,
    passos: taxas,
    comparacao,
    gargalo: gargalo
      ? { ...gargalo, taxaFormatada: `${gargalo.taxa.toFixed(1)}%` }
      : null,
    receita,
    receitaFormatada: receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    ticketMedio,
    ticketMedioFormatado: ticketMedio > 0
      ? ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—',
    taxaConversaoFinal: taxaFinal,
    origens,
    campanhas,
    anuncios,
  })
}
