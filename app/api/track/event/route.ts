import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { isIngestionBlockedForUser } from '@/lib/account-status'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function clientIp(req: Request): string | null {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return req.headers.get('x-real-ip') || null
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(`track:event:${request.headers.get('x-forwarded-for') || 'anon'}`, 60, 60_000)
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: CORS_HEADERS })
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: CORS_HEADERS })
  }

  const siteId = String(body?.site || '').trim()
  const leadId = String(body?.lead_id || '').trim()
  const event = String(body?.event || '').trim()
  if (!siteId || !leadId || !event) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400, headers: CORS_HEADERS })
  }

  // Confirma que site (= userId) existe
  const user = await prisma.user.findUnique({ where: { id: siteId }, select: { id: true } })
  if (!user) {
    return NextResponse.json({ error: 'invalid_site' }, { status: 404, headers: CORS_HEADERS })
  }

  // Modo somente leitura: plano vencido → não ingere novos eventos de tracking.
  if (await isIngestionBlockedForUser(user.id)) {
    return NextResponse.json({ skipped: true, reason: 'subscription_expired' }, { status: 200, headers: CORS_HEADERS })
  }

  const utm = body.utm || {}
  const url = body.url ? String(body.url).slice(0, 2000) : null
  const referrer = body.referrer ? String(body.referrer).slice(0, 2000) : null
  const userAgent = request.headers.get('user-agent') || null
  const ip = clientIp(request)

  try {
    // Upsert lead (cria se não existir; mantém UTMs originais)
    await prisma.trackedLead.upsert({
      where: { userId_leadId: { userId: user.id, leadId } },
      update: {
        // só atualiza UTMs se o lead não tinha
        utmSource: utm.utm_source ?? undefined,
        utmCampaign: utm.utm_campaign ?? undefined,
        utmMedium: utm.utm_medium ?? undefined,
        utmContent: utm.utm_content ?? undefined,
        utmTerm: utm.utm_term ?? undefined,
      },
      create: {
        userId: user.id,
        leadId,
        utmSource: utm.utm_source || null,
        utmCampaign: utm.utm_campaign || null,
        utmMedium: utm.utm_medium || null,
        utmContent: utm.utm_content || null,
        utmTerm: utm.utm_term || null,
        firstUrl: url,
        referrer,
        ipAddress: ip,
        userAgent,
      },
    })

    await prisma.trackedEvent.create({
      data: {
        userId: user.id,
        leadId,
        eventName: event.slice(0, 80),
        url,
        metadata: body.meta ? JSON.stringify(body.meta).slice(0, 4000) : null,
      },
    })

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch (err: any) {
    console.error('[track/event] erro:', err?.message)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: CORS_HEADERS })
  }
}
