import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Estado do 2FA da conta — consumido pela página de Segurança. NUNCA devolve o
// secret nem os códigos de recuperação, apenas metadados.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const [user, recoveryRemaining] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { twoFactorEnabled: true, twoFactorActivatedAt: true, role: true, password: true },
      }),
      prisma.twoFactorRecoveryCode.count({
        where: { userId: session.user.id, used: false },
      }),
    ])
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const role = (user.role || '').toUpperCase()
    return NextResponse.json({
      enabled: user.twoFactorEnabled,
      activatedAt: user.twoFactorActivatedAt,
      recoveryCodesRemaining: recoveryRemaining,
      required: role === 'ADMIN' || role === 'OWNER',
      hasPassword: Boolean(user.password),
    })
  } catch (error) {
    console.error('Erro ao consultar 2FA:', error)
    return NextResponse.json({ error: 'Erro ao consultar 2FA' }, { status: 500 })
  }
}
