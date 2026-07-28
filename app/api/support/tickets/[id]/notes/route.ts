import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params
    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: 'Conteúdo vazio' }, { status: 400 })

    const ticket = await prisma.supportTicket.findUnique({ where: { id } })
    if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

    const note = await prisma.supportInternalNote.create({
      data: { ticketId: id, authorId: session.user.id, content: content.trim() },
    })
    return NextResponse.json({ note }, { status: 201 })
  } catch (err) {
    console.error('[notes POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar nota' }, { status: 500 })
  }
}
