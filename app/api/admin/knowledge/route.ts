import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── GET /api/admin/knowledge ─ list articles ──────────────────────────────────
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const category  = searchParams.get('category') ?? undefined
    const q         = searchParams.get('q')         ?? undefined
    const published = searchParams.get('published')
    const adminOnly = (session.user as any).role === 'ADMIN'

    const where: any = {}
    if (!adminOnly) where.published = true           // clientes veem só publicados
    else if (published === 'true')  where.published = true
    else if (published === 'false') where.published = false
    if (category) where.category = category
    if (q)        where.OR = [
      { title:   { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
      { tags:    { contains: q, mode: 'insensitive' } },
    ]

    const articles = await prisma.knowledgeArticle.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, category: true, tags: true,
        published: true, version: true, authorId: true,
        createdAt: true, updatedAt: true,
        // Exclude full content from list to keep payload small
      },
    })

    return NextResponse.json({ articles })
  } catch (err) {
    console.error('[knowledge GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── POST /api/admin/knowledge ─ create article (admin only) ──────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { title, content, category, tags, published, version } = await request.json()
    if (!title?.trim() || !content?.trim() || !category?.trim()) {
      return NextResponse.json({ error: 'Título, conteúdo e categoria são obrigatórios' }, { status: 400 })
    }

    const article = await prisma.knowledgeArticle.create({
      data: {
        title:     title.trim(),
        content:   content.trim(),
        category:  category.trim(),
        tags:      tags     ? JSON.stringify(Array.isArray(tags) ? tags : [tags]) : null,
        published: published ?? false,
        version:   version ?? '1.0',
        authorId:  session.user.id,
      },
    })

    return NextResponse.json({ article }, { status: 201 })
  } catch (err) {
    console.error('[knowledge POST]', err)
    return NextResponse.json({ error: 'Erro ao criar artigo' }, { status: 500 })
  }
}
