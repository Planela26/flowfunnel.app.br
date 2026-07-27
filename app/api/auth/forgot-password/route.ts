import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import { getBaseUrl } from '@/lib/base-url'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import crypto from 'crypto'
import dns from 'dns/promises'

/** Verifica se o domínio do email possui registros MX válidos (aceita email). */
async function emailDomainIsValid(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1]
    if (!domain) return false
    const records = await dns.resolveMx(domain)
    return records.length > 0
  } catch {
    // ENOTFOUND, ENODATA, timeout — domínio sem MX ou inexistente
    return false
  }
}

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

    const normalizedEmail = email.toLowerCase().trim()

    // ── 1. Verifica no banco de dados ────────────────────────────────────────
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    })

    if (user) {
      // Email encontrado → fluxo normal de redefinição
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
        data: { used: true },
      })

      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token: tokenHash, expiresAt },
      })

      const appUrl = getBaseUrl()
      const resetUrl = `${appUrl}/reset-password?token=${token}`

      try {
        await sendPasswordResetEmail(user.email, user.name || '', resetUrl)
      } catch (emailErr) {
        console.error('[forgot-password] falha ao enviar email:', emailErr)
      }

      await logAudit({
        action: 'auth.password_reset_request',
        result: 'success',
        userId: user.id,
        entityType: 'User',
        entityId: user.id,
        request: req,
        metadata: { email: user.email },
      })

      return NextResponse.json({ success: true, result: 'sent' })
    }

    // ── 2. Email não está no banco — valida se o domínio é real via DNS ──────
    const domainValid = await emailDomainIsValid(normalizedEmail)

    if (!domainValid) {
      // Domínio sem registros MX → email inválido/inexistente
      return NextResponse.json(
        { error: 'Esse endereço de email não é válido. Verifique o que foi digitado.' },
        { status: 422 },
      )
    }

    // Email válido (domínio com MX) mas sem conta no FlowFunnel
    return NextResponse.json({ success: true, result: 'no_account' })
  } catch (error) {
    console.error('[forgot-password] erro interno:', error)
    return NextResponse.json(
      { error: 'Erro interno. Tente novamente em alguns instantes.' },
      { status: 500 },
    )
  }
}
