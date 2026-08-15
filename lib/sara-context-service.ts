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
    // Parallel fetch — all queries fire at once
    const [user, snapshot, funnel, recentTickets, insights, kbArticles] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true, plan: true, publicId: true, subscriptionStatus: true,
          createdAt: true, trialStatus: true,
          // Necessários para o plano EFETIVO: quem está em trial de SCALE tem
          // as capacidades do SCALE, e `plan` sozinho ainda diz FREE.
          trialEndsAt: true, trialPlan: true,
          integrations: { select: { platform: true, isActive: true }, take: 20 },
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
    const metricsStr = snapshot
      ? `Último snapshot (${snapshot.date ? new Date(snapshot.date).toLocaleDateString('pt-BR') : 'recente'}): ` +
        `Vendas ${snapshot.vendas ?? 0} | Receita R$${(snapshot.receita ?? 0).toFixed(2)} | ` +
        `Checkouts ${snapshot.checkouts ?? 0} | Leads ${snapshot.leads ?? 0} | ` +
        `Conversas WA ${snapshot.conversas ?? 0} | Gasto R$${(snapshot.gasto ?? 0).toFixed(2)}`
      : 'Sem métricas registradas ainda.'

    // Funnel stages with lead counts
    let funnelStr = 'Nenhum funil configurado.'
    if (funnel) {
      const stageNames = funnel.stages.map(s => s.name).join(' → ')
      funnelStr = `Funil: "${funnel.name}" | Etapas: ${stageNames}`
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
Total de leads rastreados: ${user?._count?.trackedLeads ?? 0}
${pageCtxStr}

INTEGRAÇÕES CONECTADAS: ${integrations.length > 0 ? integrations.join(', ') : 'nenhuma'}

MÉTRICAS: ${metricsStr}

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
      hasMetrics:  !!snapshot,
      openTickets,
      insightCount: insights.length,
    }

    return { systemContext, memories: memoriesStr, capabilities: caps, raw }
  },
}
