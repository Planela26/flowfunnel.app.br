import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAttributionSummary } from '@/lib/journey'

// GET /api/attribution/summary — resumo de atribuição do período:
// vendas por método (determinística/probabilística/unmatched) e por campanha.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const days = Math.min(parseInt(searchParams.get('days') || '30') || 30, 365)
  const summary = await getAttributionSummary(session.user.id, days)
  return NextResponse.json(summary)
}
