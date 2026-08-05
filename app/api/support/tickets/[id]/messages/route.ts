import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'

const MESSAGE_MAX_LEN = 10_000

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const { id } = await params

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, ...(isAdmin ? {} : { userId: session.user.id }) },
    })
    if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

    const messages = await prisma.supportMessage.findMany({
      where:   { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: { attachments: true },
    })
    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[messages GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const { id } = await params

    const rl = await checkRateLimit(`support:message:${session.user.id}`, 20, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas mensagens, aguarde um instante.' }, { status: 429 })

    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    if (content.trim().length > MESSAGE_MAX_LEN) {
      return NextResponse.json({ error: 'Mensagem excede o tamanho máximo permitido' }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, ...(isAdmin ? {} : { userId: session.user.id }) },
    })
    if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })
    if (ticket.status === 'closed') return NextResponse.json({ error: 'Chamado fechado' }, { status: 400 })

    const senderType = isAdmin ? 'admin' : 'user'
    const updateData: any = { updatedAt: new Date() }
    if (isAdmin && !ticket.firstResponseAt) updateData.firstResponseAt = new Date()
    if (!isAdmin && ticket.status === 'waiting_client') updateData.status = 'analyzing'
    if (isAdmin && ticket.status === 'new') updateData.status = 'analyzing'

    const [message] = await prisma.$transaction([
      prisma.supportMessage.create({
        data: { ticketId: id, senderId: session.user.id, senderType, content: content.trim() },
      }),
      prisma.supportTicket.update({ where: { id }, data: updateData }),
    ])
    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    console.error('[messages POST]', err)
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 })
  }
}
