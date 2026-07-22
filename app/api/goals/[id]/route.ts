
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Forçar rota dinâmica e compatibilidade com Next.js 14+
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Atualizar meta específica
import { NextRequest } from 'next/server';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const paramsObj = await context.params;
  const params = paramsObj;
  try {
    if (!params || !params.id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 })
    }
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { title, description, targetValue, endDate, isActive } = await request.json()

    const goal = await prisma.goal.updateMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(targetValue && { targetValue: parseFloat(targetValue) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    if (goal.count === 0) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao atualizar meta:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar meta' },
      { status: 500 }
    )
  }
}

// Deletar meta
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const paramsObj = await context.params;
  const params = paramsObj;
  try {
    if (!params || !params.id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 })
    }
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const goal = await prisma.goal.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (goal.count === 0) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar meta:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar meta' },
      { status: 500 }
    )
  }
}
