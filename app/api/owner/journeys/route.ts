import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { canAccessOwnerFunnel, getOwnerUserId } from '@/lib/owner-funnel'

const LIMITE = 50

/**
 * Lista de jornadas individuais do laboratório.
 *
 * Uma linha por lead com evento mais recente e, quando houve compra, o valor —
 * o suficiente para o Owner escolher qual jornada abrir em detalhe
 * (GET /api/owner/journeys/[leadId]).
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const autorizado = await canAccessOwnerFunnel(session?.user as any)
  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) return NextResponse.json({ error: 'Conta do laboratório não configurada' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const apenasCompras = searchParams.get('compras') === '1'

  const leads = await prisma.trackedLead.findMany({
    where: { userId: ownerId },
    orderBy: { updatedAt: 'desc' },
    take: LIMITE,
    select: {
      leadId: true, utmSource: true, utmCampaign: true, createdAt: true, updatedAt: true,
    },
  })

  const leadIds = leads.map(l => l.leadId)
  const [ultimosEventos, vendas] = await Promise.all([
    prisma.trackedEvent.findMany({
      where: { userId: ownerId, leadId: { in: leadIds } },
      orderBy: { createdAt: 'desc' },
      select: { leadId: true, eventName: true, createdAt: true },
    }),
    prisma.saleAttribution.findMany({
      where: { userId: ownerId, leadId: { in: leadIds } },
      select: { leadId: true, value: true },
    }),
  ])

  const ultimoPorLead = new Map<string, { eventName: string; createdAt: Date }>()
  for (const e of ultimosEventos) if (!ultimoPorLead.has(e.leadId)) ultimoPorLead.set(e.leadId, e)

  const vendaPorLead = new Map<string, number>()
  for (const v of vendas) if (v.leadId) vendaPorLead.set(v.leadId, (vendaPorLead.get(v.leadId) || 0) + v.value)

  let jornadas = leads.map(l => ({
    leadId: l.leadId,
    origem: l.utmSource || 'Direto',
    campanha: l.utmCampaign,
    ultimoEvento: ultimoPorLead.get(l.leadId)?.eventName ?? null,
    ultimaAtividade: (ultimoPorLead.get(l.leadId)?.createdAt ?? l.updatedAt).toISOString(),
    comprou: vendaPorLead.has(l.leadId),
    valorFormatado: vendaPorLead.has(l.leadId)
      ? vendaPorLead.get(l.leadId)!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null,
  }))

  if (apenasCompras) jornadas = jornadas.filter(j => j.comprou)

  return NextResponse.json({ jornadas })
}
