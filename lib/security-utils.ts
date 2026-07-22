import crypto from 'crypto'
import { prismaAdmin as prisma } from './prisma'

const ENC_ALGO = 'aes-256-gcm'

function getEncryptionKey() {
  const secret = process.env.SECRET_KEY || process.env.NEXTAUTH_SECRET || 'flowfunnel-local-secret'
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptSecret(value?: string | null): string | null {
  if (!value) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ENC_ALGO, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptSecret(value?: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('enc:')) return value
  const [, ivHex, tagHex, dataHex] = value.split(':')
  const decipher = crypto.createDecipheriv(ENC_ALGO, getEncryptionKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return decrypted.toString('utf8')
}

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number }

// Extrai o IP real do cliente a partir dos headers de proxy.
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return headers.get('x-real-ip') || 'unknown'
}

// Rate limiting DISTRIBUÍDO, persistido em Postgres (substitui o Map em memória
// que não sobrevivia a restarts nem funcionava entre instâncias). A contagem é
// incrementada atomicamente via INSERT ... ON CONFLICT, evitando corridas.
export async function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  const now = Date.now()
  const resetAt = new Date(now + windowMs)
  try {
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("id", "key", "count", "resetAt", "createdAt")
      VALUES (${crypto.randomUUID()}, ${key}, 1, ${resetAt}, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN ${resetAt} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"
    `
    const row = rows[0]
    const count = Number(row.count)
    const rAt = new Date(row.resetAt).getTime()
    if (count > limit) return { ok: false, remaining: 0, resetAt: rAt }
    return { ok: true, remaining: Math.max(0, limit - count), resetAt: rAt }
  } catch (e) {
    // Fail-open: um soluço no DB não deve derrubar autenticação/webhooks legítimos
    // (se o Postgres estiver fora, o app inteiro já não funciona). Erro é logado.
    console.error('checkRateLimit DB error:', e)
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs }
  }
}

export function verifyHmacSignature(rawBody: string, signature: string | null, secret?: string | null) {
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}