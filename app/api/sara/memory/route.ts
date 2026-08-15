import { NextResponse } from 'next/server'
import { requireFeature, requireSaraCapability } from '@/lib/withPlan'
import { SaraMemoryService, MemoryType } from '@/lib/sara-memory'
import { getSaraCapabilities } from '@/lib/sara-capabilities'

/**
 * Memória da Sara.AI.
 *
 * A rota não tinha nenhuma verificação de plano: qualquer conta autenticada
 * gravava e lia memória, inclusive FREE. Agora a capacidade é do plano e a
 * decisão vem de `lib/sara-capabilities` — o frontend nunca é a proteção.
 */

const VALID_TYPES: MemoryType[] = ['preference', 'goal', 'observation', 'decision']

// ── GET /api/sara/memory ───────────────────────────────────────────────────
export async function GET() {
  try {
    const guard = await requireFeature()
    if (guard.response) return guard.response

    const caps = getSaraCapabilities(guard.user.plan)
    // Ler é liberado mesmo sem a capacidade: quem fez downgrade precisa
    // enxergar e conseguir apagar o que gravou antes, em vez de ficar com
    // memória órfã invisível e sem controle. O que o plano barra é gravar.
    const memories = caps.memory ? await SaraMemoryService.getAll(guard.user.id) : []

    return NextResponse.json({
      memories,
      capabilities: {
        enabled: caps.memory,
        maxMemories: caps.maxMemories,
        retentionDays: caps.memoryRetentionDays,
        strategic: caps.strategicMemory,
        version: caps.label,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── POST /api/sara/memory ─ save new memory ────────────────────────────────
export async function POST(request: Request) {
  try {
    const guard = await requireSaraCapability('memory')
    if (guard.response) return guard.response

    const { type, content, context } = await request.json()
    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    if (!content?.trim())            return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 400 })
    // A memória entra no system prompt de TODA conversa futura: sem teto, uma
    // única memória enorme vira custo permanente em cada requisição.
    if (typeof content !== 'string' || content.length > 500) {
      return NextResponse.json({ error: 'Conteúdo muito longo (máx. 500 caracteres)' }, { status: 400 })
    }

    // `decision` é memória estratégica (SCALE). Barrado aqui com mensagem
    // comercial; sem isto o service devolveria null e a rota responderia 201
    // com `memory: null`, como se tivesse gravado.
    if (!guard.capabilities.strategicMemory && type === 'decision') {
      return NextResponse.json(
        {
          error: 'plan_required',
          capability: 'strategicMemory',
          currentPlan: guard.user.plan,
          requiredPlan: 'SCALE',
          message: 'Registrar decisões faz parte da inteligência estratégica da SARA.AI+ 2.0. Disponível no plano SCALE.',
          upgradeUrl: '/billing',
        },
        { status: 402 },
      )
    }

    const memory = await SaraMemoryService.save(
      guard.user.id,
      type,
      content.trim(),
      context,
      // Registro explícito do usuário: pesa mais que o extraído por heurística
      // quando a cota do plano obriga a escolher o que entra no contexto.
      { plan: guard.user.plan, source: 'user', importance: 'high' },
    )
    if (!memory) {
      return NextResponse.json({ error: 'Memória não disponível neste plano' }, { status: 402 })
    }

    return NextResponse.json({ memory }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── DELETE /api/sara/memory ─ delete a memory ──────────────────────────────
export async function DELETE(request: Request) {
  try {
    // Apagar não exige a capacidade, pelo mesmo motivo do GET: quem perdeu o
    // plano continua podendo remover o que é seu.
    const guard = await requireFeature()
    if (guard.response) return guard.response

    const { memoryId } = await request.json()
    if (!memoryId) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    // `delete` filtra por userId, então um id de outra conta não apaga nada.
    await SaraMemoryService.delete(guard.user.id, memoryId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
