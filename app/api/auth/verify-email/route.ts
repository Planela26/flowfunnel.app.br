import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { getBaseUrl } from '@/lib/base-url'

function getRedirectUrl(_request: Request, path: string) {
  return new URL(path, getBaseUrl())
}

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(`verify-email:${ip}`, 20, 60_000)
    if (!rl.ok) {
      return NextResponse.redirect(getRedirectUrl(request, '/verify-email?status=error'))
    }

    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return NextResponse.redirect(getRedirectUrl(request, '/verify-email?status=missing'))
    }

    const record = await prisma.emailVerificationToken.findUnique({ where: { token } })
    if (!record || record.used || record.expiresAt < new Date()) {
      return NextResponse.redirect(getRedirectUrl(request, '/verify-email?status=invalid'))
    }

    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { trialStatus: true, trialPlan: true, email: true, name: true },
    })

    const wasPendingEmail = user?.trialStatus === 'pending_email'

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          emailVerified: new Date(),
          ...(wasPendingEmail && { trialStatus: 'pending_payment' }),
        },
      }),
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ])

    await logAudit({
      action: 'auth.email_verified',
      result: 'success',
      userId: record.userId,
      entityType: 'User',
      entityId: record.userId,
      request,
      metadata: { trialStatus: wasPendingEmail ? 'pending_payment' : undefined },
    })

    return NextResponse.redirect(getRedirectUrl(request, '/verify-email?status=success'))
  } catch (error) {
    console.error('Erro ao verificar email:', error)
    return NextResponse.redirect(getRedirectUrl(request, '/verify-email?status=error'))
  }
}
