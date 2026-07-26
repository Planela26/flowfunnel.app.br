import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Marca que o usuário JÁ viu o modal "Ative seu teste grátis" pelo menos uma
 * vez. Próximas visitas a /activate-trial verão o flag e serão redirecionadas
 * automaticamente para /dashboard, em vez de exibir o modal de novo.
 *
 * - Idempotente: chamamos updateMany com condicional para não sobrescrever a
 *   primeira vez (importante para auditoria).
 * - Fail-soft: erros retornam 200 silencioso para não bloquear UX.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ ok: true })

    const now = new Date()
    await prisma.user.updateMany({
      where: {
        id: session.user.id,
        trialPromptSeenAt: null,
      },
      data: { trialPromptSeenAt: now },
    })
    return NextResponse.json({ ok: true, trialPromptSeenAt: now.toISOString() })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
