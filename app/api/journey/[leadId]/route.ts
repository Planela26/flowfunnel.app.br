import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeadJourney } from '@/lib/journey'

// GET /api/journey/:leadId — timeline completa de um lead rastreado.
// Usada pelo dashboard (visualização de jornada) e pela Flow.ai.
export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { leadId } = await params
  const journey = await getLeadJourney(session.user.id, leadId)
  if (!journey) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  }
  return NextResponse.json(journey)
}
