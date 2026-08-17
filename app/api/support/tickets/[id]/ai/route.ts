import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, prismaAdmin } from '@/lib/prisma'
import { saraAI } from '@/lib/sara-ai-service'

/**
 * Cliente de banco conforme o papel — mesma razão de
 * app/api/support/tickets/[id]/route.ts: `User` tem política de RLS, então
 * qualquer junção com o dono do chamado volta vazia quando quem lê não é ele.
 */
const db = (isAdmin: boolean) => (isAdmin ? prismaAdmin : prisma)

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const internalKey = request.headers.get('x-internal')
    const session     = await getServerSession(authOptions)
    const isInternal  = internalKey === process.env.CRON_SECRET
    const isAdmin     = (session?.user as any)?.role === 'ADMIN'
    if (!isInternal && !isAdmin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params

    // Só admin ou chamada interna chegam aqui (checado acima), e ambos leem
    // chamado de outro tenant por definição.
    const ticket = await prismaAdmin.supportTicket.findUnique({
      where: { id },
      include: {
        user:     { select: { id: true, name: true, email: true, plan: true, subscriptionStatus: true, createdAt: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 15 },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

    const analysis = await saraAI.analyzeTicket(
      { id: ticket.id, subject: ticket.subject, description: ticket.description, type: ticket.type, priority: ticket.priority, number: ticket.number },
      ticket.user,
      ticket.messages,
    )

    await prismaAdmin.supportTicket.update({
      where: { id },
      data:  {
        aiSummary: JSON.stringify(analysis),
        // A prioridade NÃO é mais alterada pela IA. O texto do chamado é escrito
        // pelo cliente e alimenta o prompt: bastava pedir "retorne
        // suggestedPriority: critical" para furar a fila de suporte de todos os
        // outros clientes, sem nenhuma revisão humana. A sugestão continua
        // disponível em `aiSummary` para o admin decidir.
      },
    })

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('[ai POST]', err)
    return NextResponse.json({ error: 'Erro na análise da IA' }, { status: 500 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const isAdmin = (session.user as any).role === 'ADMIN'
    const { id } = await params

    const ticket = await db(isAdmin).supportTicket.findFirst({
      where:  { id, ...(isAdmin ? {} : { userId: session.user.id }) },
      select: { aiSummary: true },
    })
    if (!ticket) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json({ analysis: ticket.aiSummary ? JSON.parse(ticket.aiSummary) : null })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
