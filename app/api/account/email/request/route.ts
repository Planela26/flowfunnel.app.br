import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { checkRateLimit } from '@/lib/security-utils'
import { sendEmailChangeCode } from '@/lib/email'

/**
 * Envia um código numérico de 6 dígitos para o email ATUAL da conta.
 * Esse código deve ser devolvido em /api/account/email (POST) para
 * autorizar a troca. Sem isso, troca de email exige apenas senha —
 * o que permite que um invasor com senha sequestre a conta trocando
 * o email de login.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`account:email-change:request:${session.user.id}`, 3, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 })

    const { newEmail, currentPassword } = await request.json()
    const normalized = String(newEmail || '').toLowerCase().trim()

    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Contas de login social não podem trocar email aqui (mesma regra do confirm).
    if (!user.password) {
      return NextResponse.json(
        { error: 'Sua conta usa login do Google. O e-mail é gerenciado pelo provedor e não pode ser alterado aqui.' },
        { status: 400 }
      )
    }

    if (!currentPassword) {
      return NextResponse.json({ error: 'Senha atual é obrigatória' }, { status: 400 })
    }
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

    if (user.email === normalized) {
      return NextResponse.json({ error: 'Este já é o seu email atual' }, { status: 400 })
    }

    // Verifica unicidade cross-user (precisa enxergar outros usuários → bypass).
    const exists = await prisma.user.findUnique({ where: { email: normalized } })
    if (exists) {
      return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 })
    }

    // Gera código de 6 dígitos (1 em 1.000.000 — força bruta inviabilizada
    // por rate limit + TTL de 15min + hash bcrypt no banco).
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    const codeHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    // Apaga códigos antigos não usados antes de criar um novo (evita acúmulo).
    await prisma.emailChangeCode.deleteMany({ where: { userId: user.id, used: false } })
    await prisma.emailChangeCode.create({
      data: { userId: user.id, codeHash, pendingEmail: normalized, expiresAt },
    })

    // Envia para o email ATUAL (prova de controle da conta atual).
    const result = await sendEmailChangeCode(user.email, user.name || '', code, normalized)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Não foi possível enviar o código de confirmação. Tente novamente em alguns minutos.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      sentTo: user.email,
      expiresInMinutes: 15,
      message: 'Enviamos um código de 6 dígitos para o seu email atual. Insira-o abaixo para confirmar a troca.',
    })
  } catch (error) {
    console.error('Erro ao enviar código de troca de email:', error)
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 })
  }
}
