import { prismaAdmin as prisma } from './prisma'
import { getClientIp } from './security-utils'

// Chaves que NUNCA podem ser persistidas no audit log (senhas, tokens, secrets).
const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|session|api[_-]?key|access[_-]?token|refresh[_-]?token|credential|hottok|signature|cvv|card[_-]?number/i

const MAX_SANITIZE_DEPTH = 6

function sanitize(value: any, depth = 0): any {
  if (value == null) return value
  // Primitivos podem ser retornados em qualquer profundidade.
  if (typeof value !== 'object') return value
  // SEGURANÇA: estruturas além da profundidade máxima são truncadas — NUNCA
  // retornadas cruas, senão chaves sensíveis aninhadas escapariam da redação.
  if (depth >= MAX_SANITIZE_DEPTH) return '[truncated]'
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1))
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[redacted]'
      continue
    }
    out[k] = sanitize(v, depth + 1)
  }
  return out
}

export type AuditInput = {
  action: string
  entityType?: string | null
  entityId?: string | null
  userId?: string | null
  tenantId?: string | null
  result?: 'success' | 'failure'
  metadata?: Record<string, any> | null
  request?: Request
  ip?: string | null
  userAgent?: string | null
}

// Registra uma ação sensível na trilha de auditoria. Best-effort: nunca lança
// (uma falha de auditoria não pode quebrar o fluxo principal) e nunca grava
// segredos (metadata é sanitizada antes de persistir).
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    let ip = input.ip ?? null
    let userAgent = input.userAgent ?? null
    if (input.request) {
      ip = ip ?? getClientIp(input.request.headers)
      userAgent = userAgent ?? input.request.headers.get('user-agent')
    }

    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        userId: input.userId ?? null,
        tenantId: input.tenantId ?? input.userId ?? null,
        result: input.result ?? 'success',
        ip: ip ? ip.slice(0, 100) : null,
        userAgent: userAgent ? userAgent.slice(0, 300) : null,
        metadata: input.metadata ? JSON.stringify(sanitize(input.metadata)) : null,
      },
    })
  } catch (e) {
    console.error('logAudit error:', e)
  }
}
