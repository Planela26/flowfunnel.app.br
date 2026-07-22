import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHistoryLimitDays } from '@/lib/plans'

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(fields: any[]): string {
  return fields.map(escapeCSV).join(',')
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    const maxDays = getHistoryLimitDays(dbUser?.plan)
    const earliestAllowed = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000)

    const { searchParams } = new URL(request.url)
    const requestedStart = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const startDate = requestedStart < earliestAllowed ? earliestAllowed : requestedStart
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date()

    // Fetch funnel events in date range
    const funnel = await prisma.funnel.findFirst({
      where: { userId: session.user.id },
      include: {
        events: {
          where: { timestamp: { gte: startDate, lte: endDate } },
          orderBy: { timestamp: 'asc' },
          include: { stage: true },
        },
      },
    })

    // Fetch webhook logs
    const webhookLogs = await prisma.webhookLog.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    })

    const lines: string[] = []

    // === Sheet 1: Funnel Events ===
    lines.push('EVENTOS DO FUNIL')
    lines.push(row(['Data', 'Horário', 'Etapa', 'Tipo de Evento', 'Lead ID', 'Metadados']))

    const events = funnel?.events || []
    for (const event of events) {
      const dt = new Date(event.timestamp)
      let meta = ''
      try {
        const m = JSON.parse(event.metadata || '{}')
        meta = Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(' | ')
      } catch {}

      lines.push(row([
        dt.toLocaleDateString('pt-BR'),
        dt.toLocaleTimeString('pt-BR'),
        event.stage?.name || '',
        event.eventType,
        event.leadId || '',
        meta,
      ]))
    }

    lines.push('')
    lines.push('WEBHOOKS RECEBIDOS')
    lines.push(row(['Data', 'Horário', 'Plataforma', 'Evento', 'Status', 'Duração (ms)', 'Erro']))

    for (const log of webhookLogs) {
      const dt = new Date(log.createdAt)
      lines.push(row([
        dt.toLocaleDateString('pt-BR'),
        dt.toLocaleTimeString('pt-BR'),
        log.platform,
        log.event,
        log.statusCode,
        log.duration || '',
        log.error || '',
      ]))
    }

    const csv = lines.join('\n')
    const filename = `funil_${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Erro ao exportar CSV:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
