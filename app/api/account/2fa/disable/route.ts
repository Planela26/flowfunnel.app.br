import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withTenantTx } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'

// Desativa o 2FA. Exige confirmação de senha (requisito de segurança).
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`2fa:disable:${session.user.id}`, 5, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { currentPassword } = await request.json()
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Senha é obrigatória' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // SEGURANÇA: 2FA é OBRIGATÓRIO para contas privilegiadas (ADMIN/OWNER).
    // Bloqueamos a desativação no servidor — independente da UI — para que o
    // controle de "2FA obrigatório" não possa ser contornado via chamada direta.
    const role = String(user.role || '').toUpperCase()
    if (role === 'ADMIN' || role === 'OWNER') {
      await logAudit({
        action: 'auth.2fa.disable', result: 'failure',
        userId: user.id, entityType: 'User', entityId: user.id, request,
        metadata: { reason: 'privileged_role_mandatory_2fa' },
      })
      return NextResponse.json(
        { error: 'Contas de administrador não podem desativar a verificação em duas etapas.' },
        { status: 403 },
      )
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json({ error: 'O 2FA não está ativo.' }, { status: 400 })
    }
    if (!user.password) {
      return NextResponse.json(
        { error: 'Sua conta usa login do Google e não tem senha para confirmar.' },
        { status: 400 },
      )
    }

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      await logAudit({
        action: 'auth.2fa.disable', result: 'failure',
        userId: user.id, entityType: 'User', entityId: user.id, request,
        metadata: { reason: 'invalid_password' },
      })
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 400 })
    }

    await withTenantTx(async (tx) => {
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } })
      await tx.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorActivatedAt: null },
      })
    })

    await logAudit({
      action: 'auth.2fa.disabled', result: 'success',
      userId: user.id, entityType: 'User', entityId: user.id, request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao desativar 2FA:', error)
    return NextResponse.json({ error: 'Erro ao desativar 2FA' }, { status: 500 })
  }
}
