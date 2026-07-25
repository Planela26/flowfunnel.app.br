import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET → retorna as posições salvas dos cards do FunnelFlow do usuário logado
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { funnelLayout: true },
    })

    let positions: Record<string, { x: number; y: number }> | null = null
    if (user?.funnelLayout) {
      try {
        const parsed = JSON.parse(user.funnelLayout)
        if (parsed && typeof parsed === 'object') positions = parsed
      } catch { /* JSON inválido → ignora */ }
    }

    return NextResponse.json({ positions })
  } catch (err) {
    console.error('[funnel-layout GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST → salva as posições dos cards { positions: { [nodeId]: { x, y } } }
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const positions = body?.positions
    if (!positions || typeof positions !== 'object' || Array.isArray(positions)) {
      return NextResponse.json({ error: 'positions inválido' }, { status: 400 })
    }

    // Valida formato: cada valor deve ser { x: number, y: number }
    const clean: Record<string, { x: number; y: number }> = {}
    for (const [id, pos] of Object.entries(positions as Record<string, any>)) {
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        clean[String(id)] = { x: pos.x, y: pos.y }
      }
    }
    if (Object.keys(clean).length > 100) {
      return NextResponse.json({ error: 'positions excede o limite' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { funnelLayout: JSON.stringify(clean) },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[funnel-layout POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
