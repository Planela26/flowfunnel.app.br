import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { getAdInsights } from '@/lib/facebook'
import { isSaleEvent, isCanceledSale, extractAmount, saleTransactionId } from '@/lib/sale-events'

// Shape mínimo do `Integration.config` que precisamos aqui.
type IntegrationConfig = {
  demo?: boolean
  adAccountId?: string
  accountId?: string
  ad_account_id?: string
}

function parseIntegrationConfig(
  raw: string | null | undefined
): IntegrationConfig {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as IntegrationConfig
    }
    return {}
  } catch {
    return {}
  }
}

// Snapshot diário de métricas por usuário.
// Executa para o dia anterior (yesterday) por padrão, ou para uma data específica via ?date=YYYY-MM-DD
// Pode ser disparado por:
//   - Replit Scheduled Deployment (cron diário)
//   - cURL manual com header Authorization: Bearer <CRON_SECRET>
export async function POST(request: Request) {
  return runSnapshot(request)
}

export async function GET(request: Request) {
  return runSnapshot(request)
}

const AD_CLICK_EVENTS = new Set([
  'facebook_click',
  'meta_ad_click',
  'google_click',
  'google_ad_click',
  'tiktok_click',
  'tiktok_ad_click',
])

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function runSnapshot(request: Request) {
  try {
    // SEGURANÇA: secret deve vir SOMENTE no header Authorization (URLs ficam em logs)
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const headerSecret = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (headerSecret !== cronSecret) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
    }

    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')
    // Usa horário local (mesma referência que o /api/analytics/timeseries)
    let targetDate: Date
    if (dateParam) {
      const [y, m, d] = dateParam.split('-').map(Number)
      targetDate = new Date(y, (m || 1) - 1, d || 1)
    } else {
      // Por padrão captura o dia anterior (local)
      targetDate = new Date()
      targetDate.setHours(0, 0, 0, 0)
      targetDate.setDate(targetDate.getDate() - 1)
    }

    const start = new Date(targetDate)
    const end = new Date(targetDate)
    end.setDate(end.getDate() + 1)
    const targetYmd = ymd(targetDate)

    // Pega todos os usuários ativos: com pelo menos um funil OU com uma
    // integração Meta ativa (estes têm gasto a registrar mesmo sem funil).
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { funnels: { some: {} } },
          { integrations: { some: { platform: 'META_ADS', isActive: true } } },
        ],
      },
      select: { id: true },
    })
    const userIds = users.map(u => u.id)

    // Agregados por usuário (inicializa zerado para todo usuário com funil,
    // mesmo que não tenha eventos no período).
    type Agg = {
      vendas: number; receita: number; checkouts: number; conversas: number
      leads: number; reembolsos: number; recusados: number; abandonos: number; gasto: number
    }
    const agg = new Map<string, Agg>()
    for (const id of userIds) {
      agg.set(id, {
        vendas: 0, receita: 0, checkouts: 0, conversas: 0,
        leads: 0, reembolsos: 0, recusados: 0, abandonos: 0, gasto: 0,
      })
    }

    // 1 query para TODOS os eventos do período (em vez de 1 por usuário).
    const allEvents = userIds.length
      ? await prisma.funnelEvent.findMany({
          where: {
            funnel: { userId: { in: userIds } },
            timestamp: { gte: start, lt: end },
          },
          select: {
            eventType: true,
            metadata: true,
            funnel: { select: { userId: true } },
          },
        })
      : []

    // Dedup de vendas por (userId + transação), espelhando timeseries/reports.
    const seenSaleTx = new Set<string>()

    for (const ev of allEvents) {
      const a = agg.get(ev.funnel.userId)
      if (!a) continue
      const t = ev.eventType || ''
      const meta = ev.metadata ? safeJson(ev.metadata) : {}

      if (isSaleEvent(t)) {
        if (isCanceledSale(meta)) continue
        const tx = saleTransactionId(meta)
        if (tx) {
          const key = `${ev.funnel.userId}:${tx}`
          if (seenSaleTx.has(key)) continue
          seenSaleTx.add(key)
        }
        a.vendas += 1
        a.receita += extractAmount(meta)
      } else if (/_checkout_started$/.test(t)) {
        a.checkouts += 1
      } else if (/_refunded$/.test(t)) {
        a.reembolsos += 1
      } else if (/_refused$/.test(t)) {
        a.recusados += 1
      } else if (/_abandoned$/.test(t)) {
        a.abandonos += 1
      } else if (t === 'whatsapp_conversation_started') {
        a.conversas += 1
      } else if (t === 'lead_created' || /^lead_/.test(t)) {
        a.leads += 1
      } else if (AD_CLICK_EVENTS.has(t)) {
        // Eventos de clique em anúncio com custo embutido (modo demo)
        const cost = Number(meta.cost ?? meta.spend ?? 0)
        if (Number.isFinite(cost) && cost > 0) a.gasto += cost
      }
    }

    // 1 query para TODAS as integrações Meta ativas (em vez de 1 por usuário).
    const metaIntegrations = userIds.length
      ? await prisma.integration.findMany({
          where: { userId: { in: userIds }, platform: 'META_ADS', isActive: true },
          select: { userId: true, accessToken: true, config: true },
        })
      : []

    // Para integrações Meta (META_ADS) ativas com dados reais (não-demo),
    // consulta o gasto do dia diretamente no Insights API e soma.
    for (const integ of metaIntegrations) {
      const a = agg.get(integ.userId)
      if (!a) continue
      try {
        const cfg = parseIntegrationConfig(integ.config)
        if (cfg.demo === true) continue
        const adAccountId =
          cfg.adAccountId || cfg.accountId || cfg.ad_account_id
        if (!adAccountId || !integ.accessToken) continue
        const result = await getAdInsights(
          integ.accessToken,
          String(adAccountId).replace(/^act_/, ''),
          'last_30d',
          undefined,
          { since: targetYmd, until: targetYmd }
        )
        if (result.success && result.data) {
          const spend = Number(result.data.spend || 0)
          if (Number.isFinite(spend) && spend > 0) a.gasto += spend
        }
      } catch (err) {
        console.error('Erro ao buscar spend do Meta para snapshot:', err)
      }
    }

    let processed = 0
    for (const user of users) {
      const a = agg.get(user.id)!
      await prisma.metricSnapshot.upsert({
        where: { userId_date: { userId: user.id, date: targetDate } },
        create: { userId: user.id, date: targetDate, ...a },
        update: { ...a },
      })
      processed++
    }

    return NextResponse.json({
      success: true,
      date: targetDate.toISOString().slice(0, 10),
      usersProcessed: processed,
    })
  } catch (error) {
    console.error('Erro no snapshot:', error)
    return NextResponse.json({ error: 'Erro ao gerar snapshot' }, { status: 500 })
  }
}

function safeJson(s: string): any {
  try { return typeof s === 'string' ? JSON.parse(s) : s } catch { return {} }
}
