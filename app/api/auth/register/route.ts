import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail, sendVerificationEmail } from '@/lib/email'
import { emailHasValidMx } from '@/lib/mxCheck'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { logAudit } from '@/lib/audit'
import { TRIAL_DAYS } from '@/lib/trial'
import { isDisposableEmail } from '@/lib/email-blocklist'
import { validatePasswordStrength } from '@/lib/password'
import { sendMetaCapiEvent, readFbCookies } from '@/lib/meta-capi'
import crypto from 'crypto'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAID_PLANS = ['START', 'PRO', 'SCALE']

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(`register:${ip}`, 5, 60_000)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
        { status: 429 },
      )
    }

    const { name, email, password, plan } = await request.json()
    const normalizedEmail = String(email || '').toLowerCase().trim()
    const normalizedPlan = String(plan || '').toUpperCase()

    if (!name || !normalizedEmail || !password) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    if (isDisposableEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Não é permitido usar emails descartáveis. Por favor, use um email válido.' },
        { status: 400 }
      )
    }

    const mxResult = await emailHasValidMx(normalizedEmail)
    if (!mxResult.valid) {
      return NextResponse.json(
        { error: mxResult.reason === 'timeout'
          ? 'Não foi possível validar esse email agora. Tente novamente.'
          : 'O domínio do email não existe ou não recebe mensagens. Confira se digitou corretamente.' },
        { status: 400 }
      )
    }

    const pw = validatePasswordStrength(password)
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      await logAudit({
        action: 'user.register',
        result: 'failure',
        userId: null,
        request,
        metadata: { email: normalizedEmail, reason: 'email_already_exists' },
      })
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const wantsTrial = PAID_PLANS.includes(normalizedPlan)
    const trialPlan = wantsTrial ? normalizedPlan : null
    const trialStatus = wantsTrial ? 'pending_email' : 'none'

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        plan: 'FREE',
        role: 'PRODUTOR',
        emailVerified: null,
        trialPlan,
        trialStatus,
      }
    })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const baseUrl = process.env.NEXTAUTH_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`
    sendVerificationEmail(user.email, user.name || '', verifyUrl).catch((err) => {
      console.error('❌ Erro ao enviar email de verificação:', err)
    })
    sendWelcomeEmail(user.email, user.name || '').catch((err) => {
      console.error('❌ Erro ao enviar email de boas-vindas:', err)
    })

    await logAudit({
      action: 'user.register',
      result: 'success',
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      request,
      metadata: {
        plan: 'FREE',
        trialPlan: trialPlan ?? undefined,
        trialStatus,
        email: user.email,
      },
    })

    // ── Meta CAPI: CompleteRegistration — fired on signup. (StartTrial is NOT
    // fired here; it fires only when the trial is actually activated with a card
    // in /api/stripe/activate-trial.) The browser Pixel reuses the SAME event_id.
    const { fbp, fbc } = readFbCookies(request.headers)
    const userAgent = request.headers.get('user-agent') || undefined
    const regEventId = `reg_${user.id}`

    await sendMetaCapiEvent({
      eventName: 'CompleteRegistration',
      eventId: regEventId,
      userData: { email: user.email, externalId: user.id, clientIp: ip, userAgent, fbp, fbc },
      customData: { status: wantsTrial ? 'trial_intent' : 'free' },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      requiresEmailVerification: true,
      trial: wantsTrial,
      trialDays: TRIAL_DAYS,
      trialPlan,
      meta: {
        completeRegistration: { eventId: regEventId },
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: 'FREE',
        trialPlan,
        trialStatus,
      }
    })

  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao criar conta. Tente novamente.' },
      { status: 500 }
    )
  }
}
