import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const { id } = await params

    const article = await prisma.knowledgeArticle.findUnique({ where: { id } })
    if (!article) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const isAdmin = (session.user as any).role === 'ADMIN'
    if (!isAdmin && !article.published) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    return NextResponse.json({ article })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params

    const body = await request.json()
    const { title, content, category, tags, published, version } = body

    const article = await prisma.knowledgeArticle.update({
      where: { id },
      data:  {
        ...(title     !== undefined && { title:     title.trim() }),
        ...(content   !== undefined && { content:   content.trim() }),
        ...(category  !== undefined && { category:  category.trim() }),
        ...(tags      !== undefined && { tags: JSON.stringify(Array.isArray(tags) ? tags : [tags]) }),
        ...(published !== undefined && { published }),
        ...(version   !== undefined && { version }),
        updatedAt: new Date(),
      },
    })
    return NextResponse.json({ article })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao atualizar artigo' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const { id } = await params

    await prisma.knowledgeArticle.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao excluir artigo' }, { status: 500 })
  }
}
