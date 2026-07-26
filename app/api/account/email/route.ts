import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { sendVerificationEmail } from '@/lib/email'

/**
 * Confirma a troca de email. Exige o código numérico enviado para o
 * email ATUAL em /api/account/email/request. Sem o código correto,
 * nenhum email é alterado — protege contra invasores com senha.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`account:email:confirm:${session.user.id}`, 5, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { newEmail, code, currentPassword } = await request.json()
    const normalized = String(newEmail || '').toLowerCase().trim()
    const codeStr = String(code || '').trim()

    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return NextResponse.json({ error: 'Novo email inválido' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(codeStr)) {
      return NextResponse.json({ error: 'Código de 6 dígitos obrigatório' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Contas OAuth não têm senha local — email é gerido pelo provedor.
    if (!user.password) {
      return NextResponse.json(
        {
          error: 'Sua conta usa login do Google. O e-mail é gerenciado pelo provedor e não pode ser alterado aqui.',
        },
        { status: 400 }
      )
    }

    // Bloqueia troca se o código não está nas mãos certas. O código foi
    // enviado para o email ATUAL — provar que sabe o código prova controle.
    const pendingCodes = await prisma.emailChangeCode.findMany({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() },
        pendingEmail: normalized,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    const pending = pendingCodes[0]

    if (!pending) {
      return NextResponse.json(
        { error: 'Nenhum código válido para esse email. Solicite um novo código.' },
        { status: 400 }
      )
    }

    const codeOk = await bcrypt.compare(codeStr, pending.codeHash)
    if (!codeOk) {
      return NextResponse.json({ error: 'Código incorreto ou expirado' }, { status: 400 })
    }

    // Defesa em profundidade: senha atual também é exigida. Garante que
    // quem vê a caixa de entrada do email atual não consegue trocar sem
    // ter a senha (a sessão NextAuth pode estar em dispositivo de alguém
    // que esqueceu o celular, por exemplo).
    if (!currentPassword) {
      return NextResponse.json({ error: 'Senha atual é obrigatória' }, { status: 400 })
    }
    const pwdOk = await bcrypt.compare(currentPassword, user.password)
    if (!pwdOk) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

    // Unicidade cross-user (RLS self-only em User esconderia o conflito).
    if (user.email === normalized) {
      return NextResponse.json({ error: 'Este já é o seu email atual' }, { status: 400 })
    }
    const exists = await prisma.user.findUnique({ where: { email: normalized } })
    if (exists) {
      return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 })
    }

    // Marca o código como usado.
    await prisma.emailChangeCode.update({
      where: { id: pending.id },
      data: { used: true },
    })

    // Aplica a troca. NÃO marca como verificado — exige nova confirmação no
    // NOVO email. Tokens antigos são invalidados (link de verify vai pro novo).
    await prisma.user.update({
      where: { id: user.id },
      data: { email: normalized, emailVerified: null },
    })
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
      metadata: { from: user.email, to: normalized, verified_via: 'change_code' },
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
