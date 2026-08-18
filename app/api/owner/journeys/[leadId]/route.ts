import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { canAccessOwnerFunnel, getOwnerUserId } from '@/lib/owner-funnel'

/**
 * Detalhe de uma jornada individual: a sequência completa de eventos com
 * timestamps, do clique no anúncio até a compra (ou até onde a pessoa parou).
 *
 * Reconstituída lendo TrackedEvent em ordem — a mesma tabela do rastreamento
 * de cliente, sem consulta paralela nem estrutura própria.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const session = await getServerSession(authOptions)
  const autorizado = await canAccessOwnerFunnel(session?.user as any)
  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) return NextResponse.json({ error: 'Conta do laboratório não configurada' }, { status: 404 })

  const { leadId } = await params

  const [lead, eventos, venda] = await Promise.all([
    prisma.trackedLead.findFirst({
      where: { userId: ownerId, leadId },
      select: {
        leadId: true, visitorId: true, utmSource: true, utmMedium: true, utmCampaign: true,
        utmContent: true, utmTerm: true, fbclid: true, gclid: true,
        campaignId: true, adsetId: true, adId: true,
        referrer: true, firstUrl: true, createdAt: true,
      },
    }),
    prisma.trackedEvent.findMany({
      where: { userId: ownerId, leadId },
      orderBy: { createdAt: 'asc' },
      select: { eventName: true, url: true, metadata: true, createdAt: true },
    }),
    prisma.saleAttribution.findFirst({
      where: { userId: ownerId, leadId },
      select: { value: true, product: true, method: true, confidence: true, createdAt: true },
    }),
  ])

  if (!lead) return NextResponse.json({ error: 'Jornada não encontrada' }, { status: 404 })

  return NextResponse.json({
    lead: {
      ...lead,
      createdAt: lead.createdAt.toISOString(),
    },
    linha: eventos.map(e => ({
      evento: e.eventName,
      url: e.url,
      meta: e.metadata ? JSON.parse(e.metadata) : null,
      em: e.createdAt.toISOString(),
    })),
    venda: venda
      ? {
          valor: venda.value,
          valorFormatado: venda.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          produto: venda.product,
          metodo: venda.method,
          confianca: venda.confidence,
          em: venda.createdAt.toISOString(),
        }
      : null,
  })
}
