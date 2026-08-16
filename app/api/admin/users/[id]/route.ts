import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// Painel administrativo: age sobre contas de todos os tenants por design, sob o
// gate de `role === 'ADMIN'`. Client sem RLS conforme documentado em lib/prisma.ts.
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { canHardDeleteAccount, deletionEligibilityLabel } from '@/lib/account-deletion'

const SELECT_ALVO = {
  id: true,
  email: true,
  name: true,
  role: true,
  plan: true,
  subscriptionStatus: true,
  gracePeriodEndsAt: true,
  trialStatus: true,
  trialEndsAt: true,
  trialPlan: true,
  deactivatedAt: true,
  createdAt: true,
} as const

/**
 * Resolve o admin da sessão e o usuário-alvo, aplicando as guardas comuns às
 * duas ações. Devolve `response` preenchido quando a requisição deve parar.
 */
async function resolverAlvo(request: Request, id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  }
  if ((session.user as any).role !== 'ADMIN') {
    return { response: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) }
  }

  const rl = await checkRateLimit(`admin:users:mutate:${session.user.id}`, 20, 60_000)
  if (!rl.ok) {
    return { response: NextResponse.json({ error: 'Muitas operações. Aguarde.' }, { status: 429 }) }
  }

  // Agir sobre a própria conta é sempre erro: desativar a si mesmo derruba a
  // própria sessão no mesmo request, e apagar a si mesmo destrói o acesso
  // administrativo — nos dois casos sem caminho de volta pelo painel.
  if (id === session.user.id) {
    return {
      response: NextResponse.json(
        { error: 'Você não pode executar esta ação sobre a sua própria conta.' },
        { status: 400 },
      ),
    }
  }

  const alvo = await prisma.user.findUnique({ where: { id }, select: SELECT_ALVO })
  if (!alvo) {
    return { response: NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 }) }
  }

  return { adminId: session.user.id, alvo }
}

// ── PATCH: desativar / reativar (reversível) ─────────────────────────────────
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await resolverAlvo(request, id)
    if (ctx.response) return ctx.response
    const { adminId, alvo } = ctx

    const body = await request.json().catch(() => ({} as any))
    const acao = body?.action

    if (acao !== 'deactivate' && acao !== 'reactivate') {
      return NextResponse.json({ error: "action deve ser 'deactivate' ou 'reactivate'" }, { status: 400 })
    }

    if (acao === 'deactivate') {
      if (alvo.deactivatedAt) {
        return NextResponse.json({ error: 'Esta conta já está desativada.' }, { status: 409 })
      }

      const motivo = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''

      const atualizado = await prisma.user.update({
        where: { id },
        data: {
          deactivatedAt: new Date(),
          deactivatedReason: motivo || null,
          deactivatedById: adminId,
          // Derruba as sessões abertas: qualquer JWT emitido antes passa a ter
          // versão defasada e é recusado na próxima renovação. É o mesmo
          // mecanismo usado na troca de e-mail/senha.
          sessionVersion: { increment: 1 },
        },
        select: SELECT_ALVO,
      })

      await logAudit({
        action: 'admin.user.deactivated',
        result: 'success',
        userId: adminId,
        entityType: 'User',
        entityId: id,
        request,
        metadata: { targetEmail: alvo.email, targetPlan: alvo.plan, reason: motivo || null },
      })

      return NextResponse.json({ user: atualizado })
    }

    // reactivate
    if (!alvo.deactivatedAt) {
      return NextResponse.json({ error: 'Esta conta não está desativada.' }, { status: 409 })
    }

    const atualizado = await prisma.user.update({
      where: { id },
      data: { deactivatedAt: null, deactivatedReason: null, deactivatedById: null },
      select: SELECT_ALVO,
    })

    await logAudit({
      action: 'admin.user.reactivated',
      result: 'success',
      userId: adminId,
      entityType: 'User',
      entityId: id,
      request,
      metadata: { targetEmail: alvo.email, targetPlan: alvo.plan },
    })

    return NextResponse.json({ user: atualizado })
  } catch (error) {
    console.error('[admin/users/[id] PATCH]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ── DELETE: exclusão definitiva ──────────────────────────────────────────────
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await resolverAlvo(request, id)
    if (ctx.response) return ctx.response
    const { adminId, alvo } = ctx

    // Conta viva não se apaga — ver lib/account-deletion.ts para o porquê.
    const veredito = canHardDeleteAccount(alvo)
    if (!veredito.allowed) {
      return NextResponse.json({ error: 'subscription_active', message: veredito.reason }, { status: 409 })
    }

    // Confirmação por e-mail digitado: a URL sozinha não apaga. Sem isto, um
    // clique errado na linha vizinha da tabela — ou um DELETE repetido pelo
    // histórico do navegador — destrói a conta errada, e não há desfazer.
    const { searchParams } = new URL(request.url)
    const confirmacao = (searchParams.get('confirm') || '').toLowerCase().trim()
    if (!alvo.email || confirmacao !== alvo.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'confirm_mismatch', message: 'Confirmação inválida: digite o e-mail exato da conta.' },
        { status: 400 },
      )
    }

    // Auditoria ANTES do DELETE, e com o admin como ator.
    //
    // O retrato da conta vai nos metadados porque a linha deixa de existir logo
    // abaixo: depois do delete não há mais de onde ler e-mail, plano ou data de
    // cadastro. AuditLog.userId não é chave estrangeira, então este registro
    // sobrevive à exclusão do alvo.
    await logAudit({
      action: 'admin.user.deleted',
      result: 'success',
      userId: adminId,
      entityType: 'User',
      entityId: id,
      request,
      metadata: {
        targetEmail: alvo.email,
        targetName: alvo.name,
        targetPlan: alvo.plan,
        targetRole: alvo.role,
        targetCreatedAt: alvo.createdAt?.toISOString?.() ?? null,
        elegibilidade: deletionEligibilityLabel(alvo),
      },
    })

    // As relações cascateiam (schema.prisma); Affiliate e AffiliateSale usam
    // SetNull de propósito, preservando o rastro financeiro.
    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ deleted: true, id })
  } catch (error: any) {
    // P2025 = registro já não existe (duplo clique / duas abas).
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
    }
    console.error('[admin/users/[id] DELETE]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
