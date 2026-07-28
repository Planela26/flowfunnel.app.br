import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SaraMemoryService, MemoryType } from '@/lib/sara-memory'

const VALID_TYPES: MemoryType[] = ['preference', 'goal', 'observation', 'decision']

// ── GET /api/sara/memory ───────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const memories = await SaraMemoryService.getAll(session.user.id)
    return NextResponse.json({ memories })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── POST /api/sara/memory ─ save new memory ────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { type, content, context } = await request.json()
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    if (!content?.trim())            return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 400 })

    const memory = await SaraMemoryService.save(session.user.id, type, content.trim(), context)
    return NextResponse.json({ memory }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── DELETE /api/sara/memory ─ delete a memory ──────────────────────────────
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { memoryId } = await request.json()
    if (!memoryId) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await SaraMemoryService.delete(session.user.id, memoryId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
