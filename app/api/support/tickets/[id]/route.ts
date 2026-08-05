import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TICKET_STATUSES = ['new', 'analyzing', 'investigating', 'in_development', 'waiting_client', 'resolved', 'closed']
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical']

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const { id } = await params

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, ...(isAdmin ? {} : { userId: session.user.id }) },
      include: {
        user:        { select: { id: true, name: true, email: true, plan: true, subscriptionStatus: true, createdAt: true } },
        messages:    { orderBy: { createdAt: 'asc' } },
        notes:       isAdmin ? { orderBy: { createdAt: 'desc' } } : false,
        history:     { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    return NextResponse.json({ ticket })
  } catch (err) {
    console.error('[support/tickets/[id] GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const { id } = await params
    const body = await request.json()
    const { status, priority, assigneeId } = body

    const existing = await prisma.supportTicket.findFirst({
      where: { id, ...(isAdmin ? {} : { userId: session.user.id }) },
    })
    if (!existing) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

    // Transições que um usuário comum pode disparar, e a partir de qual status atual.
    // Espelha os únicos dois botões que o front (app/suporte/[id]/page.tsx) mostra:
    // "Respondido" (waiting_client -> analyzing) e "Fechar chamado" (resolved -> closed).
    const USER_ALLOWED_TRANSITIONS: Record<string, string> = {
      waiting_client: 'analyzing',
      resolved: 'closed',
    }
    if (!isAdmin && status && USER_ALLOWED_TRANSITIONS[existing.status] !== status) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    if (status && !TICKET_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }
    if (priority && !TICKET_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: 'Prioridade inválida' }, { status: 400 })
    }

    const updateData: any = { updatedAt: new Date() }
    const historyEntries: any[] = []

    if (status && status !== existing.status) {
      updateData.status = status
      if (status === 'resolved') updateData.resolvedAt = new Date()
      if (status === 'closed')   updateData.closedAt   = new Date()
      historyEntries.push({ actorId: session.user.id, actorType: isAdmin ? 'admin' : 'user', action: 'status_changed', from: existing.status, to: status })
    }
    if (priority && priority !== existing.priority && isAdmin) {
      updateData.priority = priority
      historyEntries.push({ actorId: session.user.id, actorType: 'admin', action: 'priority_changed', from: existing.priority, to: priority })
    }
    if (assigneeId !== undefined && isAdmin) {
      updateData.assigneeId = assigneeId
      historyEntries.push({ actorId: session.user.id, actorType: 'admin', action: 'assigned', to: assigneeId })
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data:  { ...updateData, history: historyEntries.length ? { create: historyEntries } : undefined },
    })
    return NextResponse.json({ ticket })
  } catch (err) {
    console.error('[support/tickets/[id] PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar chamado' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params

    const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

    await prisma.supportTicket.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[support/tickets/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro ao excluir chamado' }, { status: 500 })
  }
}
