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

// ── In-memory cache ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

interface CacheEntry {
  context: SaraContext
  expiresAt: number
}

const contextCache = new Map<string, CacheEntry>()
// A chave inclui o pathname (rotas dinâmicas tipo /suporte/<id> geram uma entrada
// por página visitada), então sem um teto o Map cresce indefinidamente no processo
// Node de longa duração (PM2). Cap simples: ao ultrapassar o limite, remove primeiro
// as entradas expiradas e, se ainda necessário, as mais antigas (ordem de inserção).
const MAX_CACHE_ENTRIES = 500

function evictIfNeeded(): void {
  if (contextCache.size < MAX_CACHE_ENTRIES) return
  const now = Date.now()
  for (const [k, v] of contextCache) {
    if (v.expiresAt <= now) contextCache.delete(k)
  }
  while (contextCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = contextCache.keys().next().value
    if (oldestKey === undefined) break
    contextCache.delete(oldestKey)
  }
}

function cacheKey(userId: string, pathname?: string): string {
  return `${userId}::${pathname ?? ''}`
}

// ── Service ───────────────────────────────────────────────────────────────────

export const SaraContextService = {

  /**
   * Monta e retorna o contexto completo para a Sara.AI.
   * Usa cache de 5 min para evitar consultas repetidas durante uma conversa.
   */
  async buildContext(userId: string, page?: PageContext): Promise<SaraContext> {
    const key   = cacheKey(userId, page?.pathname)
    const entry = contextCache.get(key)
    if (entry && entry.expiresAt > Date.now()) return entry.context

    const context = await SaraContextService._fetch(userId, page)
    evictIfNeeded()
    contextCache.set(key, { context, expiresAt: Date.now() + CACHE_TTL_MS })
    return context
  },

  /** Invalida o cache de um usuário (chamar após mudanças de estado) */
  invalidate(userId: string): void {
    for (const key of contextCache.keys()) {
      if (key.startsWith(userId)) contextCache.delete(key)
    }
  },

  // ── Internal ───────────────────────────────────────────────────────────────

  async _fetch(userId: string, page?: PageContext): Promise<SaraContext> {
    // Parallel fetch — all queries fire at once
    const [user, snapshot, funnel, recentTickets, insights, memories, kbArticles] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true, plan: true, publicId: true, subscriptionStatus: true,
          createdAt: true, trialStatus: true,
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

      prisma.saraMemory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
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
    const plan         = user?.plan ?? 'FREE'
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

    return { systemContext, memories: memoriesStr, raw }
  },
}
