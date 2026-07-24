import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { validatePasswordStrength } from '@/lib/password'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers)
    const rl = await checkRateLimit(`reset-password:${ip}`, 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
        { status: 429 },
      )
    }

    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token e senha são obrigatórios' }, { status: 400 })
    }

    const pw = validatePasswordStrength(password)
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
    }

    if (resetToken.used) {
      return NextResponse.json({ error: 'Este link já foi utilizado' }, { status: 400 })
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Link expirado. Solicite um novo.' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
          // Se ainda não verificou o email, marca agora — o link de reset
          // já prova que o usuário tem acesso à caixa de entrada.
          emailVerified: resetToken.user.emailVerified ?? new Date(),
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ])

    await logAudit({
      action: 'auth.password_reset',
      result: 'success',
      userId: resetToken.userId,
      entityType: 'User',
      entityId: resetToken.userId,
      request: req,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
