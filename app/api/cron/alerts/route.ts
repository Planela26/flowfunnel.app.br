import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { canAccessFeature } from '@/lib/plans'
import {
  ALERT_RULES,
  parseAlertSettings,
  type AlertRuleKey,
} from '@/lib/alertSettings'

// Job diário de avaliação de alertas automáticos.
// Para cada usuário SCALE, avalia regras pré-configuradas (toggles em /settings)
// e cria registros em Notification (type='alert') quando a regra dispara.
//
// Disparo:
//   - Replit Scheduled Deployment (cron uma vez por dia)
//   - cURL com header `Authorization: Bearer <CRON_SECRET>`
//
// Performance: todos os dados necessários (snapshots, campanhas, leads das
// últimas 24h, notificações já criadas hoje) são buscados em poucas queries em
// lote e as regras são avaliadas em memória — sem loops de query por usuário ou
// por campanha. O resultado é idêntico à versão anterior.
export async function POST(request: Request) {
  return runAlerts(request)
}

export async function GET(request: Request) {
  return runAlerts(request)
}

type RuleHit = { title: string; message: string; link?: string }

type SnapRow = { date: Date; vendas: number; leads: number }
type CampaignRow = {
  name: string | null
  campaignId: string
  status: string
  spend: number
  lastSyncedAt: Date | null
}

async function runAlerts(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('CRON_SECRET não configurado — endpoint /api/cron/alerts bloqueado')
      return NextResponse.json(
        { error: 'CRON_SECRET não configurado no servidor' },
        { status: 500 },
      )
    }
    const headerSecret = request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
    if (headerSecret !== cronSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const url = new URL(request.url)
    const dryRun = url.searchParams.get('dryRun') === '1'

    // Apenas usuários elegíveis ao recurso (plano SCALE)
    const users = await prisma.user.findMany({
      where: { plan: 'SCALE' },
      select: { id: true, plan: true, alertSettings: true },
    })
    const eligible = users.filter(u =>
      canAccessFeature(u.plan, 'automatic_alerts'),
    )
    const eligibleIds = eligible.map(u => u.id)

    const summary: Array<{ userId: string; rulesFired: AlertRuleKey[] }> = []
    let totalCreated = 0

    if (eligibleIds.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        usersEvaluated: users.length,
        notificationsCreated: 0,
        summary,
      })
    }

    // --- Janelas de tempo (idênticas às regras originais) ---
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start7 = new Date(today)
    start7.setDate(start7.getDate() - 7)
    const start14 = new Date(today)
    start14.setDate(start14.getDate() - 14)
    const start2 = new Date(today)
    start2.setDate(start2.getDate() - 2)
    const since24 = new Date()
    since24.setHours(since24.getHours() - 24)
    const recentSync = new Date()
    recentSync.setDate(recentSync.getDate() - 3)

    // --- Pré-busca em lote (poucas queries para todos os usuários) ---
    const [snaps, campaigns, leadGroups, existingNotifs] = await Promise.all([
      // Snapshots dos últimos 14 dias (cobre todas as janelas das regras)
      prisma.metricSnapshot.findMany({
        where: { userId: { in: eligibleIds }, date: { gte: start14, lt: today } },
        select: { userId: true, date: true, vendas: true, leads: true },
      }),
      // Campanhas ativas (filtros específicos por regra são aplicados em memória)
      prisma.campaign.findMany({
        where: { userId: { in: eligibleIds }, isActive: true },
        select: {
          userId: true,
          name: true,
          campaignId: true,
          status: true,
          spend: true,
          lastSyncedAt: true,
        },
      }),
      // Leads das últimas 24h agrupados por (userId, utmCampaign) — substitui o
      // count por campanha. Presença no resultado = houve ao menos 1 lead.
      prisma.trackedLead.groupBy({
        by: ['userId', 'utmCampaign'],
        where: { userId: { in: eligibleIds }, createdAt: { gte: since24 } },
        _count: { _all: true },
      }),
      // Notificações de alerta já criadas hoje (dedup por título/dia)
      prisma.notification.findMany({
        where: { userId: { in: eligibleIds }, type: 'alert', createdAt: { gte: today } },
        select: { userId: true, title: true },
      }),
    ])

    // Indexação em memória
    const snapsByUser = new Map<string, SnapRow[]>()
    for (const s of snaps) {
      const arr = snapsByUser.get(s.userId) || []
      arr.push({ date: s.date, vendas: s.vendas, leads: s.leads })
      snapsByUser.set(s.userId, arr)
    }

    const campaignsByUser = new Map<string, CampaignRow[]>()
    for (const c of campaigns) {
      const arr = campaignsByUser.get(c.userId) || []
      arr.push({
        name: c.name,
        campaignId: c.campaignId,
        status: c.status,
        spend: c.spend,
        lastSyncedAt: c.lastSyncedAt,
      })
      campaignsByUser.set(c.userId, arr)
    }

    const leadSet = new Set<string>()
    for (const g of leadGroups) {
      if ((g._count?._all ?? 0) > 0 && g.utmCampaign != null) {
        leadSet.add(`${g.userId}::${g.utmCampaign}`)
      }
    }

    const existingSet = new Set<string>()
    for (const n of existingNotifs) {
      existingSet.add(`${n.userId}::${n.title}`)
    }

    // --- Avaliação em memória ---
    for (const user of eligible) {
      const settings = parseAlertSettings(user.alertSettings)
      const userSnaps = snapsByUser.get(user.id) || []
      const userCampaigns = campaignsByUser.get(user.id) || []
      const fired: AlertRuleKey[] = []

      for (const rule of ALERT_RULES) {
        if (!settings[rule.key]) continue

        let result: RuleHit | null = null
        switch (rule.key) {
          case 'sales_drop_7d':
            result = ruleSalesDrop7d(userSnaps, today, start7, start14)
            break
          case 'conversion_below_goal':
            result = ruleConversionBelowGoal(userSnaps, today, start7)
            break
          case 'campaign_no_leads_24h':
            result = ruleCampaignNoLeads24h(userCampaigns, user.id, leadSet)
            break
          case 'spend_no_return_48h':
            result = ruleSpendNoReturn48h(userCampaigns, userSnaps, today, start2, recentSync)
            break
        }
        if (!result) continue

        // Evita duplicar o mesmo alerta no mesmo dia (mesmo título)
        if (existingSet.has(`${user.id}::${result.title}`)) continue

        if (!dryRun) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: 'alert',
              title: result.title,
              message: result.message,
              link: result.link ?? null,
            },
          })
          totalCreated++
          // Espelha o estado pós-create (como o findFirst original fazia),
          // evitando duplicar caso duas regras resolvam o mesmo título no
          // mesmo run para o mesmo usuário.
          existingSet.add(`${user.id}::${result.title}`)
        }
        fired.push(rule.key)
      }

      if (fired.length > 0) summary.push({ userId: user.id, rulesFired: fired })
    }

    return NextResponse.json({
      success: true,
      dryRun,
      usersEvaluated: users.length,
      notificationsCreated: totalCreated,
      summary,
    })
  } catch (error) {
    console.error('Erro no cron de alertas:', error)
    return NextResponse.json(
      { error: 'Erro ao avaliar alertas' },
      { status: 500 },
    )
  }
}

function sumIn(
  snaps: SnapRow[],
  gte: Date,
  lt: Date,
  field: 'vendas' | 'leads',
): number {
  const a = gte.getTime()
  const b = lt.getTime()
  let total = 0
  for (const s of snaps) {
    const t = s.date.getTime()
    if (t >= a && t < b) total += s[field] || 0
  }
  return total
}

// Regra 1: vendas dos últimos 7 dias caíram >30% vs. 7 dias anteriores
function ruleSalesDrop7d(
  snaps: SnapRow[],
  today: Date,
  start7: Date,
  start14: Date,
): RuleHit | null {
  const recentSum = sumIn(snaps, start7, today, 'vendas')
  const previousSum = sumIn(snaps, start14, start7, 'vendas')

  // Precisa ter histórico relevante para evitar falsos positivos
  if (previousSum < 5) return null
  const drop = (previousSum - recentSum) / previousSum
  if (drop < 0.3) return null

  const pct = Math.round(drop * 100)
  return {
    title: 'Queda de vendas detectada',
    message: `Suas vendas caíram ${pct}% nos últimos 7 dias (${recentSum} vs. ${previousSum}). Vale revisar campanhas e funil.`,
    link: '/analytics',
  }
}

// Regra 2: conversão (vendas/leads) abaixo de 5% nos últimos 7 dias
function ruleConversionBelowGoal(
  snaps: SnapRow[],
  today: Date,
  start7: Date,
): RuleHit | null {
  const vendas = sumIn(snaps, start7, today, 'vendas')
  const leads = sumIn(snaps, start7, today, 'leads')
  if (leads < 50) return null // amostra mínima

  const rate = vendas / leads
  const goal = 0.05
  if (rate >= goal) return null

  const pct = (rate * 100).toFixed(1)
  return {
    title: 'Conversão abaixo da meta',
    message: `Sua taxa de conversão dos últimos 7 dias está em ${pct}% (meta mínima: 5%). Considere ajustar oferta, copy ou público.`,
    link: '/analytics',
  }
}

// Regra 3: campanha ativa sem gerar leads nas últimas 24h
function ruleCampaignNoLeads24h(
  campaigns: CampaignRow[],
  userId: string,
  leadSet: Set<string>,
): RuleHit | null {
  const active = campaigns.filter(c => c.status === 'ACTIVE')

  const stale: string[] = []
  for (const c of active) {
    if (!leadSet.has(`${userId}::${c.campaignId}`)) {
      stale.push(c.name || c.campaignId)
    }
  }

  if (stale.length === 0) return null

  const list = stale.slice(0, 3).join(', ')
  const more = stale.length > 3 ? ` e mais ${stale.length - 3}` : ''
  return {
    title: 'Campanha sem leads há 24h',
    message: `${stale.length} campanha(s) ativa(s) sem novos leads nas últimas 24h: ${list}${more}.`,
    link: '/campaigns',
  }
}

// Regra 4: campanhas ativas com gasto acumulado > 0 e zero vendas nas últimas 48h
// Nota: Campaign.spend é cumulativo (sincronizado da plataforma), por isso o
// alerta foca em "vendas zeradas nas últimas 48h" enquanto há gasto registrado
// na(s) campanha(s) ativa(s).
function ruleSpendNoReturn48h(
  campaigns: CampaignRow[],
  snaps: SnapRow[],
  today: Date,
  start2: Date,
  recentSync: Date,
): RuleHit | null {
  // Considera apenas campanhas sincronizadas recentemente para evitar
  // alertas baseados em gasto antigo de campanhas paradas.
  const relevant = campaigns.filter(
    c =>
      (c.spend || 0) > 0 &&
      c.lastSyncedAt != null &&
      c.lastSyncedAt.getTime() >= recentSync.getTime(),
  )

  if (relevant.length === 0) return null

  // Vendas totais do usuário nas últimas 48h
  const totalVendas = sumIn(snaps, start2, today, 'vendas')
  if (totalVendas > 0) return null

  const totalSpend = relevant.reduce((acc, c) => acc + (c.spend || 0), 0)
  if (totalSpend <= 0) return null

  return {
    title: 'Gasto sem retorno detectado',
    message: `${relevant.length} campanha(s) ativa(s) com gasto acumulado de R$ ${totalSpend.toFixed(2)} e nenhuma venda registrada nas últimas 48h.`,
    link: '/campaigns',
  }
}
