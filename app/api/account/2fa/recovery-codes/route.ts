import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withTenantTx } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/security-utils'
import { generateRecoveryCodes } from '@/lib/recovery-codes'
import { logAudit } from '@/lib/audit'

// Regenera os 10 códigos de recuperação (invalida os antigos). Exige confirmação
// de senha. Retorna os novos códigos em texto puro UMA única vez.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`2fa:recovery:${session.user.id}`, 5, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { currentPassword } = await request.json()
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Senha é obrigatória' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

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
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 400 })
    }

    const { codes, hashes } = generateRecoveryCodes()

    await withTenantTx(async (tx) => {
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } })
      await tx.twoFactorRecoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
      })
    })

    await logAudit({
      action: 'auth.2fa.recovery_regenerated', result: 'success',
      userId: user.id, entityType: 'User', entityId: user.id, request,
    })

    return NextResponse.json({ success: true, recoveryCodes: codes })
  } catch (error) {
    console.error('Erro ao regenerar códigos:', error)
    return NextResponse.json({ error: 'Erro ao regenerar códigos' }, { status: 500 })
  }
}
