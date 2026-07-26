import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Persiste o layout do FunnelFlow do usuário:
 * - `positions`: Record<string, { x, y }> → onde cada card está posicionado
 * - `visibleIds`: string[] → quais cards estão visíveis (apagar persiste aqui)
 *
 * Ambos são salvos no `User.funnelLayout` e `User.funnelVisibleIds` para
 * sincronizar entre navegadores/dispositivos.
 *
 * GET retorna ambos os campos; null = ainda não salvo.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { funnelLayout: true, funnelVisibleIds: true },
    })

    let positions: Record<string, { x: number; y: number }> | null = null
    if (user?.funnelLayout) {
      try {
        const parsed = JSON.parse(user.funnelLayout)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          positions = parsed
        }
      } catch { /* JSON inválido → ignora */ }
    }

    let visibleIds: string[] | null = null
    if (typeof user?.funnelVisibleIds === 'string' && user.funnelVisibleIds.length > 0) {
      try {
        const parsed = JSON.parse(user.funnelVisibleIds)
        if (Array.isArray(parsed)) visibleIds = parsed
      } catch { /* ignore */ }
    }

    // Importante: distingui "ainda não tenho escolha do usuário" (null) de
    // "escolhi tudo vazio pq não quero nada agora" ([]). Só assim o client
    // sabe se ainda está no default de primeiro acesso ou se foi decisão.
    return NextResponse.json({ positions, visibleIds })
  } catch (err) {
    console.error('[funnel-layout GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * Aceita:
 *   { positions?: { [nodeId]: { x: number, y: number } } }
 *   { visibleIds?: string[] }
 *
 * Apenas os campos fornecidos são atualizados (não força write se não veio).
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'body inválido' }, { status: 400 })
    }

    const data: { funnelLayout?: string; funnelVisibleIds?: string } = {}

    if ('positions' in body && body.positions != null) {
      const positions = body.positions
      if (typeof positions !== 'object' || Array.isArray(positions)) {
        return NextResponse.json({ error: 'positions inválido' }, { status: 400 })
      }
      const clean: Record<string, { x: number; y: number }> = {}
      for (const [id, pos] of Object.entries(positions as Record<string, any>)) {
        if (
          pos &&
          typeof pos.x === 'number' &&
          typeof pos.y === 'number' &&
          Number.isFinite(pos.x) &&
          Number.isFinite(pos.y)
        ) {
          clean[String(id)] = { x: pos.x, y: pos.y }
        }
      }
      if (Object.keys(clean).length > 100) {
        return NextResponse.json({ error: 'positions excede o limite' }, { status: 400 })
      }
      data.funnelLayout = JSON.stringify(clean)
    }

    if ('visibleIds' in body && body.visibleIds != null) {
      if (!Array.isArray(body.visibleIds)) {
        return NextResponse.json({ error: 'visibleIds inválido' }, { status: 400 })
      }
      // Limite de tamanho + deduplicação + validação de string.
      const ids = Array.from(
        new Set(
          body.visibleIds
            .filter((x: unknown): x is string => typeof x === 'string')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0 && s.length < 64)
        )
      )
      if (ids.length > 50) {
        return NextResponse.json({ error: 'visibleIds excede o limite' }, { status: 400 })
      }
      data.funnelVisibleIds = JSON.stringify(ids)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[funnel-layout POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
