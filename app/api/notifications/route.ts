import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Listar notificações do usuário
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Últimas 50 notificações
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    })

    return NextResponse.json(
      {
        notifications,
        unreadCount,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('Erro ao listar notificações:', error)
    return NextResponse.json(
      { error: 'Erro ao listar notificações' },
      { status: 500 }
    )
  }
}

// Criar notificação
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { type, title, message, link } = await request.json()

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: type, title, message' },
        { status: 400 }
      )
    }

    const notification = await prisma.notification.create({
      data: {
        userId: session.user.id,
        type,
        title,
        message,
        link,
      },
    })

    return NextResponse.json({ success: true, notification })
  } catch (error) {
    console.error('Erro ao criar notificação:', error)
    return NextResponse.json(
      { error: 'Erro ao criar notificação' },
      { status: 500 }
    )
  }
}
