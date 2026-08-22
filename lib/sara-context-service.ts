/**
 * SaraContextService — monta o contexto dinâmico da Sara.AI.
 *
 * Toda vez que a Sara responde, ela recebe um snapshot rico e atualizado
 * da conta do usuário: plano, integrações, métricas, funil, tickets abertos,
 * insights recentes e artigos relevantes da KB.
 *
 * Design:
 *  - Cache em memória por 5 min (evita N+1 em conversas longas)
 *  - Apenas os dados realmente necessários são buscados (select mínimo)
 *  - Não lança exceções: falhas de DB retornam contexto parcial
 */

import { prisma } from '@/lib/prisma'
import { PLATFORM_KNOWLEDGE } from '@/lib/sara-ai-service'
import { getCachedContext, setCachedContext, invalidateContext } from './sara-context-cache'
import { SaraMemoryService } from './sara-memory'
import { getSaraCapabilities, type SaraCapabilities } from './sara-capabilities'
import { getEffectivePlan } from './trial'
import { getInsightsComFallback } from './facebook'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageContext {
  /** Rota atual do usuário, ex: '/dashboard', '/analytics', '/suporte/abc' */
  pathname?: string
  /** Título da página ou módulo em foco */
  pageTitle?: string
  /** Dado adicional (ex: ID do ticket aberto) */
  entityId?: string
}

export interface SaraContext {
  /** String formatada para injetar no system prompt */
  systemContext: string
  /** Memórias relevantes do usuário */
  memories: string
  /** Capacidades da Sara para o plano efetivo — evita re-derivar na rota. */
  capabilities: SaraCapabilities
  /** Dados brutos (para debug/logging) */
  raw: {
    userName:    string | null
    plan:        string
    publicId:    string | null
    integrations: string[]
    hasMetrics:  boolean
    openTickets: number
    insightCount: number
  }
}

// O cache vive em `sara-context-cache` para que `sara-memory` possa invalidá-lo
// sem importar este arquivo — este serviço agora depende do memory service para
// selecionar memórias por plano, e os dois se importando seria um ciclo.

// ── Service ───────────────────────────────────────────────────────────────────

export const SaraContextService = {

  /**
   * Monta e retorna o contexto completo para a Sara.AI.
   * Usa cache de 5 min para evitar consultas repetidas durante uma conversa.
   */
  async buildContext(userId: string, page?: PageContext, plan?: string): Promise<SaraContext> {
    const cached = getCachedContext(userId, page?.pathname, plan)
    if (cached) return cached

    const context = await SaraContextService._fetch(userId, page)
    setCachedContext(userId, page?.pathname, context, plan)
    return context
  },

  /** Invalida o cache de um usuário (chamar após mudanças de estado) */
  invalidate(userId: string): void {
    invalidateContext(userId)
  },

  // ── Internal ───────────────────────────────────────────────────────────────

  async _fetch(userId: string, page?: PageContext): Promise<SaraContext> {
    // Meia-noite local: é o "hoje" que a pessoa quer dizer ao pedir o relatório
    // do dia, e o mesmo corte que a Meta usa em `date_preset=today`.
    const inicioDoDia = new Date()
    inicioDoDia.setHours(0, 0, 0, 0)

    // Parallel fetch — all queries fire at once
    const [
      user, snapshot, funnel, recentTickets, insights, kbArticles, vendas, campanhasMeta,
      leadsHoje, sessoesHoje, eventosHoje, conversoesHoje, origensHoje, funisDoUsuario,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true, plan: true, publicId: true, subscriptionStatus: true,
          createdAt: true, trialStatus: true,
          // Necessários para o plano EFETIVO: quem está em trial de SCALE tem
          // as capacidades do SCALE, e `plan` sozinho ainda diz FREE.
          trialEndsAt: true, trialPlan: true,
          // `accessToken` e `config` entram para permitir a leitura ao vivo da
          // Meta logo abaixo. NUNCA vão para o texto do prompt — o mapeamento
          // em `integrations` usa só platform/isActive.
          integrations: { select: { platform: true, isActive: true, accessToken: true, config: true }, take: 20 },
          goals: { select: { title: true, targetValue: true, currentValue: true, metric: true }, take: 5 },
          _count: { select: { trackedLeads: true, supportTickets: true } },
        },
      }).catch(() => null),

      prisma.metricSnapshot.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { vendas: true, receita: true, checkouts: true, conversas: true, leads: true, gasto: true, date: true },
      }).catch(() => null),

      prisma.funnel.findFirst({
        where: { userId },
        select: {
          name: true,
          stages: { select: { id: true, name: true }, orderBy: { order: 'asc' } },
        },
      }).catch(() => null),

      prisma.supportTicket.findMany({
        where: { userId, status: { notIn: ['resolved', 'closed'] } },
        select: { number: true, subject: true, status: true, priority: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),

      prisma.saraInsight.findMany({
        where: { userId, isRead: false },
        select: { type: true, title: true, severity: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }).catch(() => []),

      prisma.knowledgeArticle.findMany({
        where: { published: true },
        select: { title: true, content: true, category: true },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      }).catch(() => []),

      // Vendas atribuídas, para quando não existe snapshot diário. O snapshot é
      // escrito por /api/cron/snapshot, que era agendado no Replit e ficou sem
      // agendador na migração para a Hostinger — então a tabela pode estar
      // vazia mesmo em conta com movimento. Sem esta consulta, a Sara dizia
      // "não possui métricas registradas" para quem tem vendas no banco.
      prisma.saleAttribution.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: { value: true },
      }).catch(() => null),

      prisma.campaign.findMany({
        where: { userId, platform: 'META_ADS' },
        select: { name: true, status: true, objective: true, campaignId: true },
        take: 10,
        orderBy: { isDefault: 'desc' },
      }).catch(() => []),

      // Landing page HOJE. A Sara só tinha o total acumulado de leads, então
      // não conseguia responder "o que entrou hoje" — a pergunta mais comum.
      // Mesmas tabelas que /api/landing/metrics usa, recortadas no dia.
      prisma.trackedLead.count({ where: { userId, createdAt: { gte: inicioDoDia } } }).catch(() => 0),
      prisma.trackedSession.count({ where: { userId, startedAt: { gte: inicioDoDia } } }).catch(() => 0),
      prisma.trackedEvent.groupBy({
        by: ['eventName'],
        where: { userId, createdAt: { gte: inicioDoDia } },
        _count: { _all: true },
      }).catch(() => [] as Array<{ eventName: string; _count: { _all: number } }>),
      prisma.trackedConversion.aggregate({
        where: { userId, createdAt: { gte: inicioDoDia } },
        _count: { _all: true },
        _sum: { value: true },
      }).catch(() => null),
      prisma.trackedLead.groupBy({
        by: ['utmSource'],
        where: { userId, createdAt: { gte: inicioDoDia } },
        _count: { _all: true },
      }).catch(() => [] as Array<{ utmSource: string | null; _count: { _all: number } }>),

      // O "funil" que a pessoa cria na interface é um WORKSPACE — o próprio
      // schema chama assim (`Workspace.funnelLayout`, "layout do FunnelFlow por
      // funil"). O modelo `Funnel` consultado acima é estrutura interna, criada
      // sozinha pelo primeiro webhook que chega. Quem montou funis na tela e
      // ainda não recebeu webhook nenhum não tem nenhuma linha em `Funnel`, e a
      // Sara respondia "Nenhum funil configurado" para alguém olhando os funis
      // dele na tela ao lado.
      prisma.workspace.findMany({
        where: { userId },
        select: { name: true, emoji: true, checkoutSources: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }).catch(() => [] as Array<{ name: string; emoji: string; checkoutSources: string; createdAt: Date }>),
    ])

    // ── Assemble context string ─────────────────────────────────────────────

    const userName     = user?.name ?? 'Usuário'
    // Plano EFETIVO — considera trial em andamento, igual ao resto do produto.
    const plan         = user ? getEffectivePlan(user) : 'FREE'
    const caps         = getSaraCapabilities(plan)
    const publicId     = user?.publicId ?? null
    const integrations = (user?.integrations ?? []).map(i => `${i.platform}${i.isActive ? '' : ' (inativa)'}`)
    const openTickets  = recentTickets.length

    // Page context
    const pageCtxStr = page?.pathname
      ? `\nCONTEXTO DA TELA ATUAL: ${page.pageTitle ?? page.pathname}${page.entityId ? ` (ID: ${page.entityId})` : ''}`
      : ''

    // Metrics
    //
    // O snapshot diário continua sendo a fonte preferida — é ele que tem série
    // histórica. Mas quando não existe, a resposta NÃO é "sem métricas": os
    // números vivem em TrackedLead e SaleAttribution de qualquer jeito. Antes o
    // fallback era a frase "Sem métricas registradas ainda.", e a Sara repetia
    // isso ao usuário mesmo com campanha ativa e leads no banco.
    // VISITANTES, não leads. A tabela chama-se TrackedLead por herança, mas
    // guarda navegador anônimo — lead é quem deixou e-mail ou telefone. Chamar
    // isso de "lead" fez a Sara relatar centenas deles para uma campanha com
    // quinze cliques, e o número passou a contradizer o resto do relatório.
    const visitantesRastreados = user?._count?.trackedLeads ?? 0
    const totalVendas = vendas?._count?._all ?? 0
    const totalReceita = vendas?._sum?.value ?? 0

    const metricsStr = snapshot
      ? `Último snapshot (${snapshot.date ? new Date(snapshot.date).toLocaleDateString('pt-BR') : 'recente'}): ` +
        `Vendas ${snapshot.vendas ?? 0} | Receita R$${(snapshot.receita ?? 0).toFixed(2)} | ` +
        `Checkouts ${snapshot.checkouts ?? 0} | Leads ${snapshot.leads ?? 0} | ` +
        `Conversas WA ${snapshot.conversas ?? 0} | Gasto R$${(snapshot.gasto ?? 0).toFixed(2)}`
      : `Sem snapshot diário (série histórica indisponível). Acumulado no banco: ` +
        `Visitantes rastreados ${visitantesRastreados} | Vendas atribuídas ${totalVendas} | ` +
        `Receita R$${totalReceita.toFixed(2)}`

    // ── Mídia paga, lida AO VIVO na Meta ───────────────────────────────────────
    //
    // O snapshot não guarda impressões nem cliques — só `gasto`. Então, mesmo
    // com o cron rodando, a Sara não teria como responder "qual o relatório do
    // Facebook". Aqui ela recebe os números de verdade.
    //
    // Roda no máximo uma vez a cada 5 min por usuário, porque o contexto inteiro
    // é cacheado (ver buildContext). Falha aqui nunca derruba a Sara: no pior
    // caso ela diz que não conseguiu ler, o que já é melhor do que afirmar que
    // não existem dados.
    const metaAtiva = (user?.integrations ?? []).find(
      i => i.platform === 'META_ADS' && i.isActive,
    )

    let midiaStr = 'Nenhuma conta de anúncios conectada.'
    if (metaAtiva) {
      midiaStr = 'Meta Ads conectado, mas não foi possível ler as métricas agora.'
      try {
        const cfg = typeof metaAtiva.config === 'string'
          ? JSON.parse(metaAtiva.config)
          : (metaAtiva.config ?? {})
        const contaId = cfg?.adAccountId
        if (contaId && metaAtiva.accessToken) {
          // TRÊS janelas, não uma.
          //
          // Antes o contexto trazia só `last_7d`, e a Sara não tinha como
          // responder "o relatório de HOJE" — respondia sobre a semana e, com a
          // campanha começando a entregar hoje, concluía "sem veiculação".
          // Perguntas sobre hoje, sobre a semana e sobre o mês são as três que
          // as pessoas fazem; as três vão no contexto e ela escolhe.
          //
          // `getInsightsComFallback` cobre a conta que só reporta por campanha.
          const ids = campanhasMeta.map(c => c.campaignId).filter(Boolean) as string[]
          const [hoje, ontem, semana, mes] = await Promise.all([
            getInsightsComFallback(metaAtiva.accessToken, contaId, 'today', ids),
            getInsightsComFallback(metaAtiva.accessToken, contaId, 'yesterday', ids),
            getInsightsComFallback(metaAtiva.accessToken, contaId, 'last_7d', ids),
            getInsightsComFallback(metaAtiva.accessToken, contaId, 'last_30d', ids),
          ])

          const linha = (rotulo: string, preset: string, r: typeof hoje) => {
            // O nome do preset vai junto do rótulo de propósito. Sem ele, uma
            // resposta já saiu chamando a janela de 7 dias de "últimos 30
            // dias": com uma janela só no contexto, o modelo preencheu o rótulo
            // que a pergunta sugeria. Rótulo e origem colados tiram esse espaço.
            const cab = `${rotulo} (date_preset=${preset})`
            if (!r.success) return `${cab}: LEITURA FALHOU — ${r.error ?? 'motivo desconhecido'}. Não afirme que não houve veiculação; diga que não foi possível ler.`
            if (!r.hasDelivery || !r.data) return `${cab}: zero entrega nesta janela. A Meta respondeu normalmente — é ausência de veiculação, não falha de leitura.`
            const d = r.data
            return (
              `${cab}: Impressões ${d.impressions} | Cliques ${d.clicks} | Cliques no link ${d.linkClicks} | ` +
              `Investido R$${d.spend.toFixed(2)} | CTR ${d.ctr}% | CPC R$${d.cpc.toFixed(2)} | ` +
              `CPM R$${d.cpm.toFixed(2)} | Alcance ${d.reach}` +
              (r.fonte === 'campanhas' ? ' [somado por campanha]' : '')
            )
          }

          midiaStr =
            'Meta Ads conectado. Quatro janelas medidas AGORA, direto na Meta:\n' +
            `  - ${linha('HOJE', 'today', hoje)}\n` +
            `  - ${linha('ONTEM', 'yesterday', ontem)}\n` +
            `  - ${linha('ÚLTIMOS 7 DIAS', 'last_7d', semana)}\n` +
            `  - ${linha('ÚLTIMOS 30 DIAS', 'last_30d', mes)}\n` +
            '  COMO LER: as janelas se sobrepõem — a de 30 dias CONTÉM a de 7, que contém hoje. ' +
            'Número alto em 30 dias com zero hoje NÃO é contradição nem erro: significa que a ' +
            'campanha entregou antes e não entregou hoje. Explique isso em vez de se desculpar. ' +
            'Cite sempre a janela ao dar um número, e nunca troque o rótulo de uma janela pelo de outra. ' +
            'Se o usuário pedir uma janela que não está nesta lista, diga que não a tem — não estime.'
        } else {
          midiaStr = 'Meta Ads conectado, mas sem conta de anúncios definida na integração.'
        }
      } catch {
        /* rastreamento de mídia nunca pode quebrar a conversa */
      }
    }

    // ── Landing page HOJE ─────────────────────────────────────────────────────
    const ev: Record<string, number> = {}
    for (const e of eventosHoje) ev[e.eventName] = e._count._all

    const NOMES_ORIGEM: Record<string, string> = {
      facebook: 'Meta Ads', fb: 'Meta Ads', meta: 'Meta Ads', instagram: 'Meta Ads',
      google: 'Google Ads', adwords: 'Google Ads', tiktok: 'TikTok Ads',
    }
    const origensAgrupadas: Record<string, number> = {}
    for (const o of origensHoje) {
      const bruto = (o.utmSource || '').toLowerCase().trim()
      const nome = !bruto ? 'Direto' : (NOMES_ORIGEM[bruto] || o.utmSource || 'Outros')
      origensAgrupadas[nome] = (origensAgrupadas[nome] || 0) + o._count._all
    }
    const origensTexto = Object.entries(origensAgrupadas)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, n]) => `${nome} ${n}`)
      .join(', ')

    const cliquesHoje =
      (ev['link_click'] || 0) + (ev['click_whatsapp'] || 0) + (ev['click_checkout'] || 0)
    const receitaHoje = conversoesHoje?._sum?.value ?? 0

    const landingStr =
       `Hoje: Visitantes ${leadsHoje} | Sessões ${sessoesHoje} | Page views ${ev['page_view'] || 0} | ` +
      `Cliques ${cliquesHoje} (link ${ev['link_click'] || 0}, WhatsApp ${ev['click_whatsapp'] || 0}, ` +
      `checkout ${ev['click_checkout'] || 0}) | Conversões ${conversoesHoje?._count?._all ?? 0} | ` +
      `Receita R$${receitaHoje.toFixed(2)}` +
      (origensTexto ? ` | Origens: ${origensTexto}` : '') +
      `. Acumulado de sempre: ${visitantesRastreados} visitantes rastreados (visitas anônimas, NÃO leads — lead é quem deixou contato).`

    const campanhasStr = campanhasMeta.length > 0
      ? campanhasMeta.map(c => `${c.name} [${c.status}${c.objective ? `, ${c.objective}` : ''}]`).join('; ')
      : 'Nenhuma campanha sincronizada.'

    // Os funis do usuário são os WORKSPACES. As etapas vêm do modelo `Funnel`,
    // que é interno e só existe depois do primeiro webhook — por isso as duas
    // coisas são reportadas separadas, e a ausência de uma não nega a outra.
    let funnelStr: string
    if (funisDoUsuario.length > 0) {
      const lista = funisDoUsuario.map(f => {
        let checkouts: string[] = []
        try { checkouts = JSON.parse(f.checkoutSources || '[]') } catch { checkouts = [] }
        return `${f.emoji} "${f.name}"${checkouts.length ? ` (checkout: ${checkouts.join(', ')})` : ''}`
      }).join('; ')
      funnelStr = `${funisDoUsuario.length} funil(is): ${lista}`
      if (funnel) {
        funnelStr += ` | Etapas do rastreamento: ${funnel.stages.map(s => s.name).join(' → ')}`
      } else {
        // Distinção que importa: os funis EXISTEM, o que não chegou foi evento.
        funnelStr += ' | Nenhuma etapa de rastreamento criada ainda — isso acontece' +
          ' quando nenhum webhook de checkout chegou até agora. Os funis estão criados.'
      }
    } else if (funnel) {
      funnelStr = `Funil interno: "${funnel.name}" | Etapas: ${funnel.stages.map(s => s.name).join(' → ')}`
    } else {
      funnelStr = 'Nenhum funil criado.'
    }

    // Open tickets
    const ticketsStr = openTickets === 0
      ? 'Nenhum chamado aberto.'
      : recentTickets.map(t => `#${t.number} [${t.priority}] ${t.subject} (${t.status})`).join('; ')

    // Insights
    const insightsStr = insights.length === 0
      ? 'Nenhum insight pendente.'
      : insights.map(i => `[${i.severity.toUpperCase()}] ${i.title}`).join('; ')

    // Goals
    const goalsStr = (user?.goals ?? []).length > 0
      ? (user?.goals ?? []).map(g => `${g.title} (${g.metric}): ${g.currentValue}/${g.targetValue}`).join(' | ')
      : 'Sem metas configuradas.'

    // KB
    const kbStr = kbArticles.length > 0
      ? kbArticles.map(a => `[${a.category}] ${a.title}: ${a.content.slice(0, 150)}`).join('\n')
      : ''

    const systemContext = `
${PLATFORM_KNOWLEDGE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO DO USUÁRIO ATUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nome: ${userName}
ID FlowSara: ${publicId ?? 'não gerado'}
Plano: ${plan} | Assinatura: ${user?.subscriptionStatus ?? 'desconhecida'}
Cliente desde: ${user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '—'}
Total de visitantes rastreados: ${user?._count?.trackedLeads ?? 0} (visitas anônimas; lead exige contato)
${pageCtxStr}

INTEGRAÇÕES CONECTADAS: ${integrations.length > 0 ? integrations.join(', ') : 'nenhuma'}

MÉTRICAS: ${metricsStr}

MÍDIA PAGA: ${midiaStr}

LANDING PAGE / RASTREAMENTO: ${landingStr}

CAMPANHAS META: ${campanhasStr}

FUNIL: ${funnelStr}

METAS: ${goalsStr}

CHAMADOS ABERTOS: ${ticketsStr}

INSIGHTS PENDENTES: ${insightsStr}

${kbStr ? `BASE DE CONHECIMENTO RELEVANTE:\n${kbStr}` : ''}
`.trim()

    // ── Memories ───────────────────────────────────────────────────────────

    // Buscadas depois do bloco paralelo de propósito: a seleção depende da cota
    // do plano, e o plano só é conhecido após a consulta do usuário acima.
    // Antes, 10 memórias iam para o prompt de QUALQUER plano, inclusive FREE.
    const memories = await SaraMemoryService.getForContext(userId, plan).catch(() => [])

    const memoriesStr = memories.length > 0
      ? memories.map(m => `[${m.type.toUpperCase()}] ${m.content}`).join('\n')
      : ''

    const raw = {
      userName, plan, publicId,
      integrations,
      // "Tem métrica" passou a incluir o que existe fora do snapshot — era
      // justamente o caso em que a Sara se declarava sem dados.
      hasMetrics:  !!snapshot || visitantesRastreados > 0 || totalVendas > 0 || Boolean(metaAtiva),
      openTickets,
      insightCount: insights.length,
    }

    return { systemContext, memories: memoriesStr, capabilities: caps, raw }
  },
}
