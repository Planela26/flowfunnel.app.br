import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TICKET_STATUSES = ['new', 'analyzing', 'investigating', 'in_development', 'waiting_client', 'resolved', 'closed']
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical']

function adminOnly(session: any) {
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  return null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const err = adminOnly(session); if (err) return err
    const { id } = await params

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user:        { select: { id: true, name: true, email: true, plan: true, subscriptionStatus: true, createdAt: true } },
        messages:    { orderBy: { createdAt: 'asc' } },
        notes:       { orderBy: { createdAt: 'desc' } },
        history:     { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    return NextResponse.json({ ticket })
  } catch (err) {
    console.error('[admin/support/[id] GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const err = adminOnly(session); if (err) return err
    const { id } = await params
    const body   = await request.json()

    const ticket = await prisma.supportTicket.findUnique({ where: { id } })
    if (!ticket) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    if (body.status && !TICKET_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }
    if (body.priority && !TICKET_PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: 'Prioridade inválida' }, { status: 400 })
    }

    const updateData: any  = { updatedAt: new Date() }
    const historyEntries: any[] = []

    if (body.status && body.status !== ticket.status) {
      updateData.status = body.status
      if (body.status === 'resolved') updateData.resolvedAt = new Date()
      if (body.status === 'closed')   updateData.closedAt   = new Date()
      historyEntries.push({ actorId: (session as any).user.id, actorType: 'admin', action: 'status_changed', from: ticket.status, to: body.status })
    }
    if (body.priority && body.priority !== ticket.priority) {
      updateData.priority = body.priority
      historyEntries.push({ actorId: (session as any).user.id, actorType: 'admin', action: 'priority_changed', from: ticket.priority, to: body.priority })
    }
    if (body.assigneeId !== undefined) {
      updateData.assigneeId = body.assigneeId
      historyEntries.push({ actorId: (session as any).user.id, actorType: 'admin', action: 'assigned', to: body.assigneeId ?? 'none' })
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data:  { ...updateData, history: historyEntries.length ? { create: historyEntries } : undefined },
    })
    return NextResponse.json({ ticket: updated })
  } catch (err) {
    console.error('[admin/support/[id] PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar chamado' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const err = adminOnly(session); if (err) return err
    const { id } = await params

    const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

    await prisma.supportTicket.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/support/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro ao excluir chamado' }, { status: 500 })
  }
}
