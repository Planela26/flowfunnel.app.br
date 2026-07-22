import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, prismaAdmin } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`account:email:${session.user.id}`, 5, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { newEmail, currentPassword } = await request.json()
    const normalized = String(newEmail || '').toLowerCase().trim()

    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (user.email === normalized) {
      return NextResponse.json({ error: 'Este já é o seu email atual' }, { status: 400 })
    }

    // Se a conta tem senha, exigir senha atual para confirmar.
    if (user.password) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Senha atual é obrigatória' }, { status: 400 })
      }
      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) {
        return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
      }
    } else {
      // Contas de login social não têm senha local: o e-mail é gerenciado pelo
      // provedor (Google). Trocá-lo aqui não tem segundo fator confiável e
      // quebraria o vínculo OAuth — por isso é bloqueado.
      return NextResponse.json(
        {
          error: 'Sua conta usa login do Google. O e-mail é gerenciado pelo provedor e não pode ser alterado aqui.',
        },
        { status: 400 }
      )
    }

    // Checagem de unicidade é cross-user (precisa enxergar OUTROS usuários) →
    // usa o cliente bypass; RLS self-only em User esconderia o conflito.
    const exists = await prismaAdmin.user.findUnique({ where: { email: normalized } })
    if (exists) {
      return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 })
    }

    // SEGURANÇA: trocar o e-mail NÃO marca como verificado. Marcamos como não
    // verificado e enviamos um link de verificação para o NOVO e-mail. O acesso
    // completo só volta após a confirmação (middleware bloqueia rotas protegidas).
    await prisma.user.update({
      where: { id: user.id },
      data: { email: normalized, emailVerified: null },
    })

    // Invalida tokens antigos e gera um novo para o novo e-mail
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`
    sendVerificationEmail(normalized, user.name || '', verifyUrl).catch(() => {})

    await logAudit({
      action: 'account.email_change',
      result: 'success',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      request,
      metadata: { from: user.email, to: normalized },
    })

    return NextResponse.json({
      success: true,
      email: normalized,
      requiresEmailVerification: true,
      message: 'E-mail alterado. Enviamos um link de confirmação para o novo endereço.',
    })
  } catch (error) {
    console.error('Erro ao trocar email:', error)
    return NextResponse.json({ error: 'Erro ao trocar email' }, { status: 500 })
  }
}
