/**
 * SaraInsightsService — geração de insights proativos da Sara.AI.
 *
 * Analisa os dados do usuário e gera insights automáticos como:
 *   - "Seu funil perdeu 18% de conversão desde ontem"
 *   - "O custo por lead aumentou significativamente"
 *   - "Três integrações apresentam falhas"
 *
 * Pode ser chamado:
 *   - Manualmente via API admin
 *   - Por um cron job
 *   - Após eventos relevantes (webhook recebido, nova sessão, etc.)
 */

import { prisma } from '@/lib/prisma'
import { SaraObserver } from './sara-observer'

export interface InsightSummary {
  userId:    string
  total:     number
  unread:    number
  critical:  number
  latest:    string | null
}

export const SaraInsightsService = {

  /**
   * Analisa o estado atual do usuário e gera insights proativos.
   * Chamada idempotente — não duplica insights já gerados hoje.
   */
  async analyzeUser(userId: string): Promise<number> {
    let generated = 0

    const [metrics, recentTickets, integrations] = await Promise.all([
      // Últimos 2 snapshots para detectar queda
      prisma.metricSnapshot.findMany({
        where:   { userId },
        orderBy: { date: 'desc' },
        take:    2,
        select:  { vendas: true, receita: true, conversas: true, leads: true, gasto: true, date: true },
      }).catch(() => []),

      // Tickets recentes abertos
      prisma.supportTicket.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }).catch(() => 0),

      // Integrações inativas
      prisma.integration.count({
        where: { userId, isActive: false },
      }).catch(() => 0),
    ])

    // ── Detecta queda de métricas ───────────────────────────────────────────
    if (metrics.length === 2) {
      const [latest, prev] = metrics
      const vendasDrop = prev.vendas > 0
        ? ((prev.vendas - latest.vendas) / prev.vendas) * 100
        : 0

      if (vendasDrop > 15) {
        const alreadyToday = await prisma.saraInsight.count({
          where: {
            userId, type: 'metric_anomaly',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }).catch(() => 0)

        if (alreadyToday === 0) {
          await SaraObserver.emit('metric_anomaly', userId, {
            description: `Vendas caíram ${vendasDrop.toFixed(1)}% em relação ao dia anterior (${prev.vendas} → ${latest.vendas}). Verifique suas campanhas e integrações.`,
          })
          generated++
        }
      }
    }

    // ── Alerta de integrações inativas ─────────────────────────────────────
    if (integrations > 0) {
      const alreadyToday = await prisma.saraInsight.count({
        where: {
          userId, type: 'integration_disconnected',
          createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        },
      }).catch(() => 0)

      if (alreadyToday === 0) {
        await SaraObserver.emit('integration_disconnected', userId, {
          platform: `${integrations} integração(ões)`,
        })
        generated++
      }
    }

    // ── Alerta de volume de tickets ─────────────────────────────────────────
    if (recentTickets >= 3) {
      const alreadyToday = await prisma.saraInsight.count({
        where: {
          userId, type: 'ticket_spike',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }).catch(() => 0)

      if (alreadyToday === 0) {
        await SaraObserver.emit('ticket_spike', userId, {
          count: recentTickets, topic: 'problemas nas últimas 24h',
        })
        generated++
      }
    }

    return generated
  },

  /**
   * Retorna um sumário de insights para exibir no dashboard.
   */
  async getSummary(userId: string): Promise<InsightSummary> {
    const [total, unread, critical, latest] = await Promise.all([
      prisma.saraInsight.count({ where: { userId } }),
      prisma.saraInsight.count({ where: { userId, isRead: false } }),
      prisma.saraInsight.count({ where: { userId, severity: 'critical', isRead: false } }),
      prisma.saraInsight.findFirst({
        where:   { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
        select:  { title: true },
      }),
    ])

    return { userId, total, unread, critical, latest: latest?.title ?? null }
  },
}
