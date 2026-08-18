import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { canAccessOwnerFunnel, getOwnerUserId, DEGRAUS } from '@/lib/owner-funnel'

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
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

  const [eventosPorNome, conversoes, porOrigem, porCampanha, porAd] = await Promise.all([
    prisma.trackedEvent.groupBy({
      by: ['eventName'],
      where: { userId: ownerId, createdAt: { gte: desde } },
      _count: { _all: true },
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

  const contagem: Record<string, number> = {}
  for (const e of eventosPorNome) contagem[e.eventName] = e._count._all

  // Cada degrau soma os eventos que o compõem (ex.: engajamento = qualquer
  // scroll >= 50%). `distinctLeads` não é usado aqui de propósito: contar
  // EVENTOS é a métrica de volume; a taxa entre degraus é o que interessa, e
  // ela é robusta a um lead disparar o mesmo scroll mais de uma vez porque o
  // gate por evento+página no LabTracker já evita reenvio na mesma carga.
  const passos = DEGRAUS.map(d => ({
    chave: d.chave,
    rotulo: d.rotulo,
    total: d.eventos.reduce((acc, ev) => acc + (contagem[ev] || 0), 0),
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

  return NextResponse.json({
    periodoDias: dias,
    passos: taxas,
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
