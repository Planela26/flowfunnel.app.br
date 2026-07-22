import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers)
    const rl = await checkRateLimit(`forgot-password:${ip}`, 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
        { status: 429 },
      )
    }

    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Invalidate any existing unexpired tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true },
    })

    const token = crypto.randomBytes(32).toString('hex')
    // Store only the SHA-256 hash; the raw token lives solely in the email link.
    // If the DB leaks, the stored hash cannot be used to reset a password.
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: tokenHash, expiresAt },
    })

    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:5000'
    const resetUrl = `${appUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail(user.email, user.name || '', resetUrl)

    await logAudit({
      action: 'auth.password_reset_request',
      result: 'success',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      request: req,
      metadata: { email: user.email },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
