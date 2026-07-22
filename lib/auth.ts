// Em dev no Replit, sobrescreve NEXTAUTH_URL para o domínio público do preview
// (caso contrário, o cookie/CSRF do NextAuth bate com localhost e o login falha silenciosamente)
if (process.env.NODE_ENV !== 'production' && process.env.REPLIT_DEV_DOMAIN) {
  process.env.NEXTAUTH_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`
}

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { headers } from 'next/headers'
import { prismaAdmin as prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit, getClientIp, decryptSecret } from './security-utils'
import { logAudit } from './audit'
import { verifyTOTP } from './totp'
import { hashRecoveryCode } from './recovery-codes'
import { isTrialExpiredForToken } from './auth-trial'

// Lê IP/User-Agent da request atual (contexto do route handler do NextAuth).
async function requestMeta(): Promise<{ ip: string; userAgent: string | null }> {
  try {
    const h = (await headers()) as unknown as Headers
    return { ip: getClientIp(h), userAgent: h.get('user-agent') }
  } catch {
    return { ip: 'unknown', userAgent: null }
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        totp: { label: 'Código 2FA', type: 'text' },
      },
      async authorize(credentials) {
        // SEGURANÇA: mensagens genéricas para reduzir enumeração
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Credenciais inválidas')
        }

        const email = credentials.email.toLowerCase().trim()
        const { ip, userAgent } = await requestMeta()

        // Rate limiting distribuído anti brute-force: por IP+email e por IP.
        const [byCombo, byIp] = await Promise.all([
          checkRateLimit(`login:${ip}:${email}`, 5, 60_000),
          checkRateLimit(`login:ip:${ip}`, 30, 60_000),
        ])
        if (!byCombo.ok || !byIp.ok) {
          await logAudit({
            action: 'auth.login', result: 'failure', userId: null, ip, userAgent,
            metadata: { email, reason: 'rate_limited' },
          })
          throw new Error('Muitas tentativas. Aguarde um momento e tente novamente.')
        }

        const user = await prisma.user.findUnique({ where: { email } })

        if (!user || !user.password) {
          // Mantém tempo similar ao bcrypt.compare para não vazar via timing
          await bcrypt.compare(credentials.password, '$2a$12$abcdefghijklmnopqrstuv')
          await logAudit({
            action: 'auth.login', result: 'failure', userId: null, ip, userAgent,
            metadata: { email, reason: 'invalid_credentials' },
          })
          throw new Error('Credenciais inválidas')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          await logAudit({
            action: 'auth.login', result: 'failure', userId: user.id, ip, userAgent,
            metadata: { email, reason: 'invalid_password' },
          })
          throw new Error('Credenciais inválidas')
        }

        // SEGUNDO FATOR: se o usuário tem 2FA ativo, a senha sozinha não basta.
        if (user.twoFactorEnabled) {
          const code = (credentials.totp ?? '').trim()
          if (!code) {
            // Senha correta, mas falta o código. Sinaliza pro frontend pedir o
            // segundo fator (sem criar sessão).
            throw new Error('2FA_REQUIRED')
          }

          // Rate limit dedicado + bloqueio temporário (5 tentativas / 5 min).
          const tfaLimit = await checkRateLimit(`2fa:login:${user.id}`, 5, 300_000)
          if (!tfaLimit.ok) {
            await logAudit({
              action: 'auth.2fa.login', result: 'failure', userId: user.id, ip, userAgent,
              metadata: { email, reason: 'rate_limited' },
            })
            throw new Error('Muitas tentativas de verificação. Aguarde alguns minutos.')
          }

          const secret = decryptSecret(user.twoFactorSecret)
          const digitsOnly = code.replace(/\s+/g, '')
          let verified = false
          let viaRecovery = false

          if (/^\d{6}$/.test(digitsOnly)) {
            // TOTP de 6 dígitos.
            verified = secret ? verifyTOTP(digitsOnly, secret) : false
          } else {
            // Código de recuperação: consumo ATÔMICO (uso único garantido pelo
            // banco — a cláusula used:false no UPDATE evita corrida TOCTOU; só uma
            // tentativa concorrente consegue count===1).
            const hash = hashRecoveryCode(code)
            const claim = await prisma.twoFactorRecoveryCode.updateMany({
              where: { userId: user.id, codeHash: hash, used: false },
              data: { used: true, usedAt: new Date() },
            })
            verified = claim.count === 1
            viaRecovery = verified
          }

          if (!verified) {
            await logAudit({
              action: 'auth.2fa.login', result: 'failure', userId: user.id, ip, userAgent,
              metadata: { email, reason: 'invalid_code' },
            })
            throw new Error('Código de verificação inválido')
          }

          if (viaRecovery) {
            await logAudit({
              action: 'auth.2fa.recovery_used', result: 'success', userId: user.id, ip, userAgent,
              entityType: 'User', entityId: user.id,
            })
          } else {
            await logAudit({
              action: 'auth.2fa.login', result: 'success', userId: user.id, ip, userAgent,
              entityType: 'User', entityId: user.id,
            })
          }
        }

        await logAudit({
          action: 'auth.login', result: 'success', userId: user.id, ip, userAgent,
          entityType: 'User', entityId: user.id, metadata: { method: 'credentials' },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        }
      }
    })
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      // SEGURANÇA: só aceita login Google se o e-mail for verificado pelo Google.
      if (account?.provider === 'google') {
        const verified = (profile as any)?.email_verified
        if (verified === false) return false

        // 2FA: o fluxo OAuth não tem etapa de segundo fator. Se o usuário ativou
        // 2FA, bloqueamos o login via Google (fail-closed) e orientamos a usar
        // email + senha, onde o TOTP é exigido. Sem isso, o Google seria um
        // bypass do segundo fator.
        const email = (profile as any)?.email || user?.email
        if (email) {
          const dbUser = await prisma.user.findUnique({
            where: { email },
            select: { twoFactorEnabled: true },
          })
          if (dbUser?.twoFactorEnabled) {
            return '/login?error=2fa_use_password'
          }
        }
      }
      return true
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.emailVerified = token.emailVerified as Date | null
        session.user.twoFactorEnabled = Boolean(token.twoFactorEnabled)
      }
      return session
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        // Busca emailVerified do banco no momento do login
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { emailVerified: true, twoFactorEnabled: true, subscriptionStatus: true, gracePeriodEndsAt: true, trialEndsAt: true, trialPlan: true, trialStatus: true },
        })
        token.emailVerified = dbUser?.emailVerified ?? null
        token.twoFactorEnabled = dbUser?.twoFactorEnabled ?? false
        token.subscriptionStatus = dbUser?.subscriptionStatus ?? null
        token.gracePeriodEndsAt = dbUser?.gracePeriodEndsAt ?? null
        // Trial expiration check for JWT
        token.trialExpired = isTrialExpiredForToken(dbUser)
      }
      // Ao forçar update() no cliente (ex: após verificar email / (des)ativar 2FA),
      // recarrega emailVerified e twoFactorEnabled.
      if (trigger === 'update') {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { emailVerified: true, twoFactorEnabled: true, subscriptionStatus: true, gracePeriodEndsAt: true, trialEndsAt: true, trialPlan: true, trialStatus: true },
        })
        if (dbUser) {
          token.emailVerified = dbUser.emailVerified
          token.twoFactorEnabled = dbUser.twoFactorEnabled
          token.subscriptionStatus = dbUser.subscriptionStatus
          token.gracePeriodEndsAt = dbUser.gracePeriodEndsAt
          token.trialExpired = isTrialExpiredForToken(dbUser)
        }
      }
      // Fallback defensivo: se o token não tem emailVerified mas o usuário já verificou
      // no banco (ex: update() falhou silenciosamente), atualiza o token automaticamente.
      // Só bate no banco quando emailVerified ainda está null — período pré-verificação.
      if (!token.emailVerified && token.id && !user && trigger !== 'update') {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { emailVerified: true, subscriptionStatus: true, gracePeriodEndsAt: true, trialEndsAt: true, trialPlan: true, trialStatus: true },
        })
        if (dbUser?.emailVerified) {
          token.emailVerified = dbUser.emailVerified
        }
        if (token.subscriptionStatus === undefined) {
          token.subscriptionStatus = dbUser?.subscriptionStatus ?? null
          token.gracePeriodEndsAt = dbUser?.gracePeriodEndsAt ?? null
          token.trialExpired = isTrialExpiredForToken(dbUser)
        }
      }
      return token
    }
  },
  events: {
    async signIn({ user, account }) {
      // Login por credenciais já é auditado no authorize; aqui cobrimos OAuth (Google).
      if (account?.provider === 'credentials') return
      const { ip, userAgent } = await requestMeta()
      await logAudit({
        action: 'auth.login', result: 'success', userId: user?.id ?? null, ip, userAgent,
        entityType: 'User', entityId: user?.id ?? null,
        metadata: { method: account?.provider ?? 'oauth' },
      })
    },
    async signOut({ token }) {
      const { ip, userAgent } = await requestMeta()
      await logAudit({
        action: 'auth.logout', result: 'success', userId: (token?.id as string) ?? null,
        ip, userAgent, entityType: 'User', entityId: (token?.id as string) ?? null,
      })
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    // SEGURANÇA: TTL menor que o default (30d) e rotação a cada 24h.
    maxAge: 14 * 24 * 60 * 60, // 14 dias
    updateAge: 24 * 60 * 60,   // 1 dia
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET,
}
