import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, withTenantTx } from '@/lib/prisma'
import { checkRateLimit, decryptSecret } from '@/lib/security-utils'
import { verifyTOTP } from '@/lib/totp'
import { generateRecoveryCodes } from '@/lib/recovery-codes'
import { logAudit } from '@/lib/audit'

// Conclui a ativação do 2FA: confirma um código TOTP contra o secret pendente.
// Se válido, habilita o 2FA e gera 10 códigos de recuperação (mostrados UMA vez).
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`2fa:activate:${session.user.id}`, 5, 300_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde alguns minutos.' },
        { status: 429 },
      )
    }

    const { code } = await request.json()
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Código é obrigatório' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: 'O 2FA já está ativo.' }, { status: 400 })
    }
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Inicie a configuração do 2FA antes de confirmar.' },
        { status: 400 },
      )
    }

    const secret = decryptSecret(user.twoFactorSecret)
    if (!secret || !verifyTOTP(code, secret)) {
      await logAudit({
        action: 'auth.2fa.activate', result: 'failure',
        userId: session.user.id, entityType: 'User', entityId: session.user.id, request,
      })
      return NextResponse.json({ error: 'Código inválido. Tente novamente.' }, { status: 400 })
    }

    const { codes, hashes } = generateRecoveryCodes()

    await withTenantTx(async (tx) => {
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: session.user.id } })
      await tx.user.update({
        where: { id: session.user.id },
        data: { twoFactorEnabled: true, twoFactorActivatedAt: new Date() },
      })
      await tx.twoFactorRecoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId: session.user.id, codeHash })),
      })
    })

    await logAudit({
      action: 'auth.2fa.enabled', result: 'success',
      userId: session.user.id, entityType: 'User', entityId: session.user.id, request,
    })

    // Códigos de recuperação retornados UMA única vez (texto puro).
    return NextResponse.json({ success: true, recoveryCodes: codes })
  } catch (error) {
    console.error('Erro ao ativar 2FA:', error)
    return NextResponse.json({ error: 'Erro ao ativar 2FA' }, { status: 500 })
  }
}
