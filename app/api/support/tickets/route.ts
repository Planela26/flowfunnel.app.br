import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── GET /api/support/tickets ─ list user's tickets ───────────────────────────
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status   = searchParams.get('status') ?? undefined
    const type     = searchParams.get('type')   ?? undefined
    const priority = searchParams.get('priority') ?? undefined
    const q        = searchParams.get('q')      ?? undefined
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit    = 20

    const where: any = { userId: session.user.id }
    if (status)   where.status   = status
    if (type)     where.type     = type
    if (priority) where.priority = priority
    if (q)        where.subject  = { contains: q, mode: 'insensitive' }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, number: true, subject: true, type: true,
          priority: true, status: true, createdAt: true, updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ])

    return NextResponse.json({ tickets, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[support/tickets GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── POST /api/support/tickets ─ create ticket ─────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { subject, description, type, priority } = await request.json()

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Assunto e descrição são obrigatórios' }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId:      session.user.id,
        subject:     subject.trim(),
        description: description.trim(),
        type:        type     ?? 'question',
        priority:    priority ?? 'medium',
        status:      'new',
        history: {
          create: {
            actorId:   session.user.id,
            actorType: 'user',
            action:    'created',
          },
        },
        messages: {
          create: {
            senderId:   session.user.id,
            senderType: 'user',
            content:    description.trim(),
          },
        },
      },
      select: { id: true, number: true, subject: true, status: true, createdAt: true },
    })

    // Trigger Sara.AI analysis in background (fire-and-forget)
    fetch(`${process.env.NEXTAUTH_URL ?? ''}/api/support/tickets/${ticket.id}/ai`, {
      method: 'POST',
      headers: { 'x-internal': process.env.CRON_SECRET ?? '' },
    }).catch(() => {})

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (err) {
    console.error('[support/tickets POST]', err)
    return NextResponse.json({ error: 'Erro ao criar chamado' }, { status: 500 })
  }
}
