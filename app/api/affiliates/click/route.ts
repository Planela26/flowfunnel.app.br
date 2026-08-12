import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { setAttributionCookie } from '@/lib/affiliate-attribution'

// Nota de escopo: AffiliateClick em si NÃO alimenta comissão — é telemetria
// (dashboard do próprio afiliado, app/api/affiliate/me/*). Desde a Fase 3,
// esta rota também emite o cookie ff_attr assinado (lib/affiliate-attribution.ts),
// que É a fonte de verdade da atribuição usada nos checkouts — não o
// affiliateId aceito aqui no corpo, que continua existindo só para registrar
// o clique em si. Mesmo assim, aplicamos rate limit e dedup para não deixar
// a métrica ser inflada trivialmente.
const CLICK_DEDUP_WINDOW_MS = 10 * 60_000

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(`affiliates:click:${ip}`, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
    }

    const { affiliateId } = await request.json()
    if (!affiliateId || typeof affiliateId !== 'string') {
      return NextResponse.json({ error: 'affiliateId obrigatório' }, { status: 400 })
    }

    const headersList = await headers()
    const userAgent = headersList.get('user-agent')?.slice(0, 300) || null

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { id: true, status: true },
    })

    if (!affiliate || affiliate.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 })
    }

    // Dedup por IP+afiliado numa janela curta: o AffiliateTracker dispara uma
    // vez por carregamento de página, mas nada impede reload manual repetido
    // ou um script simples de reenviar o mesmo POST.
    const recent = await prisma.affiliateClick.findFirst({
      where: {
        affiliateId,
        ip,
        createdAt: { gte: new Date(Date.now() - CLICK_DEDUP_WINDOW_MS) },
      },
      select: { id: true },
    })
    if (!recent) {
      await prisma.affiliateClick.create({
        data: { affiliateId, ip, userAgent },
      })
    }

    const response = NextResponse.json({ ok: true })
    setAttributionCookie(response, affiliateId)
    return response
  } catch (error: any) {
    return NextResponse.json({ error: 'Não foi possível registrar o clique.' }, { status: 500 })
  }
}
