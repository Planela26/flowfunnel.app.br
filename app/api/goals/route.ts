import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Criar nova meta
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { title, description, targetValue, metric, platform, endDate } = await request.json()

    if (!title || !targetValue || !metric || !endDate) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: title, targetValue, metric, endDate' },
        { status: 400 }
      )
    }

    const goal = await prisma.goal.create({
      data: {
        userId: session.user.id,
        title,
        description,
        targetValue: parseFloat(targetValue),
        metric,
        platform: platform || 'ALL',
        endDate: new Date(endDate),
      },
    })

    return NextResponse.json({ success: true, goal })
  } catch (error) {
    console.error('Erro ao criar meta:', error)
    return NextResponse.json(
      { error: 'Erro ao criar meta' },
      { status: 500 }
    )
  }
}

// Listar metas do usuário
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const goals = await prisma.goal.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [
        { isCompleted: 'asc' },
        { endDate: 'asc' },
      ],
    })

    return NextResponse.json({ goals })
  } catch (error) {
    console.error('Erro ao listar metas:', error)
    return NextResponse.json(
      { error: 'Erro ao listar metas' },
      { status: 500 }
    )
  }
}
