import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHistoryLimitDays, normalizePlan } from '@/lib/plans'
import { leadsDoFunil } from '@/lib/funil-produtos'

/**
 * Métricas da Landing Page para o node do funil visual.
 *
 * NÃO cria rastreamento novo: lê exatamente as tabelas que o tracker.js e o
 * link rastreável já alimentam — TrackedLead, TrackedSession, TrackedEvent,
 * TrackedConversion — preservando a estrutura visitante → sessão → lead →
 * eventos.
 *
 * Isolamento: todas as consultas filtram por `userId` da sessão, no mesmo
 * padrão das demais rotas de métrica. Nenhum parâmetro do cliente escolhe de
 * quem são os dados.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
    const maxDias = getHistoryLimitDays(normalizePlan(u?.plan))

    const { searchParams } = new URL(request.url)
    const pedido = parseInt(searchParams.get('days') || '30', 10)
    const dias = Math.min(Number.isFinite(pedido) && pedido > 0 ? pedido : 30, maxDias)
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

    // Separação por funil, reusando a campanha que o funil já vincula.
    // TrackedLead guarda `campaignId` (macro da Meta na URL do anúncio), e o
    // Workspace guarda `facebookCampaignId` — o cruzamento não precisa de
    // configuração nova. Sem campanha vinculada, segue sem filtro: é o
    // comportamento de antes e o que mantém funil sem campanha funcionando.
    const workspaceId = searchParams.get('workspaceId')

    // Preferência pelo LINK RASTREÁVEL, não pela campanha. O link é escolha
    // explícita e funciona venha o clique de onde vier — anúncio, WhatsApp, bio
    // ou e-mail. A campanha só separa quem chegou por anúncio COM as macros da
    // Meta na URL, o que deixa de fora todo tráfego que não é pago.
    const leadsDoLink = await leadsDoFunil(workspaceId, userId, desde)

    let campanhaDoFunil: string | null = null
    if (workspaceId && leadsDoLink === null) {
      const ws = await prisma.workspace.findFirst({
        where: { id: workspaceId, userId },
        select: { facebookCampaignId: true },
      })
      campanhaDoFunil = ws?.facebookCampaignId || null
    }

    const doFunil = leadsDoLink !== null
      ? { leadId: { in: leadsDoLink } }
      : campanhaDoFunil
        ? { campaignId: campanhaDoFunil }
        : {}

    const [
      sites,
      visitantes,
      sessoes,
      leads,
      eventosPorNome,
      conversoes,
      porOrigem,
      leadsDeSempre,
    ] = await Promise.all([
      prisma.trackedSite.count({ where: { userId } }),
      // Visitante = navegador distinto. `visitorId` só passou a ser gravado
      // depois da migration de alinhamento, então contamos leads distintos
      // como piso quando ele não existe.
      prisma.trackedLead.findMany({
        where: { userId, createdAt: { gte: desde }, ...doFunil },
        select: { visitorId: true, leadId: true },
      }),
      prisma.trackedSession.count({ where: { userId, startedAt: { gte: desde } } }),
      prisma.trackedLead.count({ where: { userId, createdAt: { gte: desde }, ...doFunil } }),
      prisma.trackedEvent.groupBy({
        by: ['eventName'],
        where: { userId, createdAt: { gte: desde } },
        _count: { _all: true },
      }),
      prisma.trackedConversion.aggregate({
        where: { userId, createdAt: { gte: desde } },
        _count: { _all: true },
        _sum: { value: true },
      }),
      prisma.trackedLead.groupBy({
        by: ['utmSource'],
        where: { userId, createdAt: { gte: desde }, ...doFunil },
        _count: { _all: true },
      }),
      // Sem recorte de data — ver `connected` mais abaixo.
      prisma.trackedLead.count({ where: { userId, ...doFunil } }),
    ])

    const eventos: Record<string, number> = {}
    for (const e of eventosPorNome) eventos[e.eventName] = e._count._all

    const visitantesUnicos = new Set(
      visitantes.map(v => v.visitorId || v.leadId),
    ).size

    const pageViews = eventos['page_view'] || 0
    const cliquesLink = eventos['link_click'] || 0
    const cliquesWhats = eventos['click_whatsapp'] || 0
    const cliquesCheckout = eventos['click_checkout'] || 0
    const scroll = eventos['scroll_60'] || 0
    const totalConversoes = conversoes._count._all || 0
    const receita = conversoes._sum.value || 0

    const taxa = visitantesUnicos > 0
      ? `${((totalConversoes / visitantesUnicos) * 100).toFixed(1)}%`
      : '—'

    // Origem legível a partir do utm_source cru, com os nomes que o cliente
    // reconhece nos anúncios. `null` vira "Direto": chegou sem parâmetro.
    const NOMES: Record<string, string> = {
      facebook: 'Meta Ads', fb: 'Meta Ads', meta: 'Meta Ads', instagram: 'Meta Ads',
      google: 'Google Ads', adwords: 'Google Ads',
      tiktok: 'TikTok Ads', bing: 'Microsoft Ads', microsoft: 'Microsoft Ads',
      organic: 'Orgânico', direct: 'Direto',
    }
    const origensAgrupadas: Record<string, number> = {}
    for (const o of porOrigem) {
      const bruto = (o.utmSource || '').toLowerCase().trim()
      const nome = !bruto ? 'Direto' : (NOMES[bruto] || o.utmSource || 'Outros')
      origensAgrupadas[nome] = (origensAgrupadas[nome] || 0) + o._count._all
    }
    const origens = Object.entries(origensAgrupadas)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)

    // `connected` decide se o card mostra números ou o estado vazio, e por isso
    // responde "existe rastreamento instalado?" — NÃO "houve movimento agora?".
    //
    // Antes olhava `leads`, que é contado dentro do período: uma semana parada
    // zerava a contagem e o card voltava ao estado de "não integrado", como se
    // a instalação tivesse sumido. Zero visita em sete dias é um RESULTADO, e
    // precisa aparecer como zero — some com o dado e a pessoa vai reinstalar um
    // rastreamento que nunca deixou de funcionar.
    //
    // `leadsDeSempre` cobre quem já rastreava pelo tracker.js antes de existir
    // o cadastro de site: sem ele, essas contas perderiam o card.
    const connected = sites > 0 || leadsDeSempre > 0

    return NextResponse.json({
      connected,
      // Mesma ideia do `filtroDeProdutos` do Hotmart: se este card está ou não
      // recortado por funil precisa ser legível na tela. Sem isso, "mostra os
      // visitantes do outro funil" e "este funil não tem campanha vinculada"
      // são exatamente a mesma coisa aos olhos de quem olha.
      filtroDoFunil: {
        workspaceId: workspaceId ?? null,
        // Por qual critério este card foi recortado, ou null se por nenhum.
        por: leadsDoLink !== null ? 'link' : campanhaDoFunil ? 'campanha' : null,
        visitantesDoLink: leadsDoLink?.length ?? null,
        campanha: campanhaDoFunil,
        aplicado: leadsDoLink !== null || campanhaDoFunil !== null,
      },
      periodoDias: dias,
      sitesCadastrados: sites,
      visitantes: visitantesUnicos,
      sessoes,
      leads,
      pageViews,
      cliques: cliquesLink + cliquesWhats + cliquesCheckout,
      cliquesLink,
      cliquesWhatsapp: cliquesWhats,
      cliquesCheckout,
      scroll60: scroll,
      conversoes: totalConversoes,
      taxaConversao: taxa,
      receita,
      receitaFormatada: receita > 0
        ? receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '—',
      origemPrincipal: origens[0]?.nome ?? '—',
      origens,
    })
  } catch (error) {
    console.error('[landing/metrics]', error)
    // 200 com a falha DESCRITA, em vez de 500 mudo.
    //
    // O dashboard descarta resposta não-ok e mantém o último dado bom — o que
    // é certo para uma oscilação de rede, mas com falha persistente o card
    // ficava eternamente no estado inicial, dizendo "Gere um link rastreável"
    // para uma conta com centenas de leads registrados. A pessoa não tinha como
    // saber que algo quebrou, e o motivo morria no log do servidor.
    return NextResponse.json({
      connected: false,
      erro: true,
      mensagem: 'Não foi possível carregar as métricas de rastreamento.',
      detalhe: error instanceof Error ? error.message : String(error),
    })
  }
}
