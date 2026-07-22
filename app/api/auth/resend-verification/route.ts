import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prismaAdmin as prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { sendVerificationEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/security-utils'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`verify:resend:${session.user.id}`, 10, 300_000)
    if (!rl.ok) return NextResponse.json({ error: 'Aguarde antes de pedir outro' }, { status: 429 })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email já verificado' }, { status: 400 })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Limpa tokens antigos do usuário antes de criar um novo
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`
    sendVerificationEmail(user.email, user.name || '', verifyUrl).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao reenviar verificação:', error)
    return NextResponse.json({ error: 'Erro ao reenviar email' }, { status: 500 })
  }
}
