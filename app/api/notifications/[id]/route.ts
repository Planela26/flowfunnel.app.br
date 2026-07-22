import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Marcar notificação como lida
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const paramsObj = await context.params;
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await prisma.notification.updateMany({
      where: {
        id: paramsObj.id,
        userId: session.user.id,
      },
      data: {
        isRead: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao marcar notificação:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar notificação' },
      { status: 500 }
    )
  }
}

// Deletar notificação
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const paramsObj = await context.params;
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await prisma.notification.deleteMany({
      where: {
        id: paramsObj.id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar notificação:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar notificação' },
      { status: 500 }
    )
  }
}
