import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Persiste o layout do FunnelFlow:
 * - `positions`: Record<string, { x, y }> → onde cada card está posicionado
 * - `visibleIds`: string[] → quais cards estão visíveis (apagar persiste aqui)
 *
 * ── Escopo: por FUNIL, com queda para a conta ───────────────────────────────
 *
 * Cada "funil" da interface é um Workspace. Antes o arranjo vivia só em
 * `User.funnelLayout`/`User.funnelVisibleIds` — UM por conta, lido por todos os
 * funis. Arrastar um card num funil movia o card do outro, e esconder um card
 * escondia nos dois.
 *
 * Agora, com `?workspaceId=`, lê e grava no Workspace. Quando o Workspace ainda
 * não tem arranjo próprio (`null`), a LEITURA cai no valor do usuário: assim
 * quem já tinha organizado seu painel encontra tudo no lugar, e a divergência
 * começa no primeiro arraste. A ESCRITA vai sempre para o Workspace, para que
 * um funil nunca mais sobrescreva o outro.
 *
 * Sem `workspaceId` o comportamento antigo é mantido, para não quebrar chamador
 * que ainda não passa o parâmetro.
 *
 * GET retorna ambos os campos; null = ainda não salvo em lugar nenhum.
 */
function parsePositions(raw: string | null | undefined) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, { x: number; y: number }>
    }
  } catch { /* JSON inválido → ignora */ }
  return null
}

function parseVisibleIds(raw: string | null | undefined) {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as string[]
  } catch { /* ignore */ }
  return null
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const workspaceId = new URL(req.url).searchParams.get('workspaceId')

    const [user, workspace] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { funnelLayout: true, funnelVisibleIds: true },
      }),
      // `userId` no filtro: é o que impede ler o funil de outra conta passando
      // um id alheio. Mesmo padrão das demais rotas com id vindo do cliente.
      workspaceId
        ? prisma.workspace.findFirst({
            where: { id: workspaceId, userId: session.user.id },
            select: { funnelLayout: true, funnelVisibleIds: true },
          })
        : Promise.resolve(null),
    ])

    // Workspace primeiro; usuário como ponto de partida enquanto o funil não
    // tiver arranjo próprio.
    const positions = parsePositions(workspace?.funnelLayout) ?? parsePositions(user?.funnelLayout)
    const visibleIds = parseVisibleIds(workspace?.funnelVisibleIds) ?? parseVisibleIds(user?.funnelVisibleIds)

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

    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : null

    if (workspaceId) {
      // updateMany com userId no filtro: um id de funil alheio não altera nada
      // e devolve count 0, em vez de escrever na conta de outro.
      const r = await prisma.workspace.updateMany({
        where: { id: workspaceId, userId: session.user.id },
        data,
      })
      if (r.count !== 1) {
        return NextResponse.json({ error: 'Funil não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ success: true, escopo: 'workspace' })
    }

    // Sem funil informado: comportamento antigo, no nível da conta.
    await prisma.user.update({
      where: { id: session.user.id },
      data,
    })

    return NextResponse.json({ success: true, escopo: 'user' })
  } catch (err) {
    console.error('[funnel-layout POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
