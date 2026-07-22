import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`account:delete:${session.user.id}`, 3, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { confirm, currentPassword, confirmEmail } = await request.json().catch(() => ({}))

    if (confirm !== 'DELETAR') {
      return NextResponse.json(
        { error: 'Confirmação inválida. Digite DELETAR para confirmar.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (user.password) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Senha atual é obrigatória' }, { status: 400 })
      }
      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) {
        return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
      }
    } else {
      // Contas de login social não têm senha. Exigimos um segundo fator:
      // digitar o e-mail exato da conta para confirmar a exclusão.
      const provided = String(confirmEmail || '').toLowerCase().trim()
      if (!provided || provided !== (user.email || '').toLowerCase()) {
        return NextResponse.json(
          { error: 'Para confirmar, digite o e-mail da sua conta.', requiresEmailConfirmation: true },
          { status: 400 }
        )
      }
    }

    // Audita ANTES de deletar (a linha de auditoria não referencia FK do usuário).
    await logAudit({
      action: 'account.delete',
      result: 'success',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      request,
      metadata: { email: user.email },
    })

    // onDelete: Cascade no schema cuida de funnels, integrations, notifications etc.
    await prisma.user.delete({ where: { id: user.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar conta:', error)
    return NextResponse.json({ error: 'Erro ao deletar conta' }, { status: 500 })
  }
}
