import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'

/**
 * Determina a URL base pública do app, mesmo quando atrás de proxy
 * (Google Frontend, Replit, etc.) onde request.url pode vir como
 * http://0.0.0.0:5000/... em vez da URL pública.
 */
function getBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = request.headers.get('host')

  // Proxy reverso (Google Frontend, Cloudflare, etc.)
  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`
  }

  // Host header (fallback)
  if (host && !host.includes('0.0.0.0') && !host.includes('localhost')) {
    return `https://${host}`
  }

  // Env vars
  const envUrl = process.env.NEXTAUTH_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
  if (envUrl) return envUrl

  // Fallback final
  return 'https://flowfunnel.app.br'
}

function getRedirectUrl(request: Request, path: string) {
  return new URL(path, getBaseUrl(request))
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
