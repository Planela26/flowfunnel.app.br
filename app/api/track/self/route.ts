import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { getOwnerUserId, EVENTOS_DO_NAVEGADOR } from '@/lib/owner-funnel'

/**
 * Rastreamento do funil PRÓPRIO do FlowSara.
 *
 * Diferença essencial para /api/track/event: aqui o navegador NÃO informa de
 * quem é o dado. Lá o `site` viaja no HTML da página do cliente — aceitável,
 * porque o dado é dele e ele escolheu instalar. Aqui, expor a conta Owner
 * permitiria a qualquer um injetar eventos falsos no funil que serve para
 * decidir investimento em anúncio. A conta é resolvida no servidor.
 *
 * Grava nas MESMAS tabelas do rastreamento de cliente. Não há segundo sistema:
 * o FlowSara vira, para efeito de dados, um cliente de si mesmo.
 */
export const dynamic = 'force-dynamic'

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const CLICK_IDS = ['fbclid', 'gclid', 'ttclid', 'msclkid'] as const

function texto(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers)

    // Teto por IP. Uma pessoa navegando dispara poucos eventos por minuto;
    // este limite só barra automação.
    const rl = await checkRateLimit(`track:self:${ip}`, 60, 60_000)
    if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 })

    const ownerId = await getOwnerUserId()
    if (!ownerId) return NextResponse.json({ ok: false }, { status: 204 })

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false }, { status: 400 })

    const leadId = texto(body.lead_id, 80)
    const visitorId = texto(body.visitor_id, 80)
    const sessionId = texto(body.session_id, 80)
    const evento = texto(body.event, 40)

    if (!leadId || !evento) return NextResponse.json({ ok: false }, { status: 400 })

    // Lista fechada: o navegador não inventa nomes de evento. Sem isto, um
    // curioso poderia poluir o funil com degraus que não existem — ou forjar
    // `payment_approved`, que é gravado SOMENTE pelo webhook.
    if (!EVENTOS_DO_NAVEGADOR.includes(evento)) {
      return NextResponse.json({ ok: false, error: 'evento_desconhecido' }, { status: 400 })
    }

    const utm: Record<string, string | null> = {}
    for (const k of UTM_KEYS) utm[k] = texto(body.utm?.[k])
    const click: Record<string, string | null> = {}
    for (const k of CLICK_IDS) click[k] = texto(body.click_ids?.[k], 400)

    const campaignId = texto(body.creative?.campaign_id, 64)
    const adsetId = texto(body.creative?.adset_id, 64)
    const adId = texto(body.creative?.ad_id, 64)

    const url = texto(body.url, 2000)
    const referrer = texto(body.referrer, 2000)

    // A identidade é criada no primeiro evento e reaproveitada nos seguintes.
    // `?? undefined` no update preserva o que já foi capturado: o page_view
    // traz as UTMs, e os eventos posteriores (scroll, cta) chegam sem elas —
    // sobrescrever com null apagaria a origem no meio da jornada.
    await prisma.trackedLead.upsert({
      where: { userId_leadId: { userId: ownerId, leadId } },
      update: {
        visitorId: visitorId ?? undefined,
        utmSource: utm.utm_source ?? undefined,
        utmMedium: utm.utm_medium ?? undefined,
        utmCampaign: utm.utm_campaign ?? undefined,
        utmContent: utm.utm_content ?? undefined,
        utmTerm: utm.utm_term ?? undefined,
        fbclid: click.fbclid ?? undefined,
        gclid: click.gclid ?? undefined,
        ttclid: click.ttclid ?? undefined,
        msclkid: click.msclkid ?? undefined,
        campaignId: campaignId ?? undefined,
        adsetId: adsetId ?? undefined,
        adId: adId ?? undefined,
      },
      create: {
        userId: ownerId,
        leadId,
        visitorId,
        utmSource: utm.utm_source,
        utmMedium: utm.utm_medium,
        utmCampaign: utm.utm_campaign,
        utmContent: utm.utm_content,
        utmTerm: utm.utm_term,
        fbclid: click.fbclid,
        gclid: click.gclid,
        ttclid: click.ttclid,
        msclkid: click.msclkid,
        campaignId,
        adsetId,
        adId,
        firstUrl: url,
        referrer,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
      },
    })

    if (sessionId) {
      await prisma.trackedSession.upsert({
        where: { userId_sessionId: { userId: ownerId, sessionId } },
        update: { lastSeen: new Date() },
        create: { userId: ownerId, sessionId, visitorId, leadId, firstUrl: url, referrer },
      })
    }

    await prisma.trackedEvent.create({
      data: {
        userId: ownerId,
        leadId,
        sessionId,
        eventName: evento,
        url,
        metadata: body.meta ? JSON.stringify(body.meta).slice(0, 2000) : null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[track/self]', error)
    // 200 mesmo em erro: o navegador não tem o que fazer com a falha, e um
    // status de erro só encheria o console do visitante.
    return NextResponse.json({ ok: false })
  }
}
