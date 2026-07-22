import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizePlan } from '@/lib/plans'

/**
 * Gera mensagens dinâmicas de upgrade baseadas em dados reais do usuário.
 * Não retorna nada para usuários PRO ou superior.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  })
  const plan = normalizePlan(user?.plan)

  // PRO/SCALE não recebem trigger de upgrade
  if (plan === 'PRO' || plan === 'SCALE') {
    return NextResponse.json({ triggers: [] })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const baseWhere = { userId: session.user.id, createdAt: { gte: since } }

  // Agrega no banco (count) em vez de carregar milhares de logs + payloads em memória.
  const [cliques, conversas, checkouts, vendas] = await Promise.all([
    prisma.webhookLog.count({ where: { ...baseWhere, platform: { in: ['META_ADS', 'FACEBOOK'] } } }),
    prisma.webhookLog.count({ where: { ...baseWhere, platform: 'WHATSAPP', event: 'message' } }),
    prisma.webhookLog.count({ where: { ...baseWhere, event: { contains: 'checkout', mode: 'insensitive' } } }),
    prisma.webhookLog.count({
      where: {
        ...baseWhere,
        OR: [
          { event: { contains: 'approved', mode: 'insensitive' } },
          { event: { contains: 'paid', mode: 'insensitive' } },
          { event: { contains: 'confirm', mode: 'insensitive' } },
        ],
      },
    }),
  ])
  const leads = conversas

  const triggers: Array<{ id: string; severity: 'info' | 'warning' | 'danger'; title: string; message: string; cta: string }> = []

  if (cliques >= 50 && vendas / Math.max(cliques, 1) < 0.02) {
    triggers.push({
      id: 'wasted_clicks',
      severity: 'danger',
      title: `Você teve ${cliques} cliques que podem estar sendo desperdiçados`,
      message: 'Sem a análise PRO você não consegue ver quais campanhas estão queimando dinheiro. Descubra agora.',
      cta: 'Ver análise completa (PRO)',
    })
  }

  if (leads >= 20) {
    triggers.push({
      id: 'unscored_leads',
      severity: 'warning',
      title: `Você tem ${leads} leads — mas quais realmente valem a pena?`,
      message: 'O PRO classifica cada lead como quente, morno ou frio com score de 0–100. Foque nos que convertem.',
      cta: 'Desbloquear classificação',
    })
  }

  if (checkouts >= 5 && vendas / Math.max(checkouts, 1) < 0.4) {
    triggers.push({
      id: 'low_conversion',
      severity: 'danger',
      title: 'Sua taxa de conversão de checkout está baixa',
      message: 'O PRO mostra exatamente onde o lead desiste e sugere ações para recuperar a venda.',
      cta: 'Diagnóstico completo (PRO)',
    })
  }

  if (triggers.length === 0 && (cliques > 0 || leads > 0)) {
    triggers.push({
      id: 'general',
      severity: 'info',
      title: 'Você está perdendo análises que podem aumentar seu faturamento',
      message: 'Score de leads, classificação automática e detecção de tráfego desperdiçado estão liberados no PRO.',
      cta: 'Conhecer o PRO',
    })
  }

  return NextResponse.json({ triggers, plan, stats: { cliques, conversas, leads, vendas, checkouts } })
}
