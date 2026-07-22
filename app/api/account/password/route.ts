import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { validatePasswordStrength } from '@/lib/password'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`account:password:${session.user.id}`, 5, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Senha atual e nova são obrigatórias' }, { status: 400 })
    }

    const pw = validatePasswordStrength(newPassword)
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (!user.password) {
      return NextResponse.json(
        { error: 'Sua conta usa login do Google. Não há senha para alterar.' },
        { status: 400 }
      )
    }

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    })

    await logAudit({
      action: 'account.password_change',
      result: 'success',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao trocar senha:', error)
    return NextResponse.json({ error: 'Erro ao trocar senha' }, { status: 500 })
  }
}
