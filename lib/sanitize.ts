// Utilitários para mascarar PII em logs (LGPD-safe).

export function maskEmail(email?: string | null): string | null {
  if (!email || typeof email !== 'string') return null
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}***@${domain}`
}

export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null
  const s = String(phone).replace(/\D/g, '')
  if (s.length < 4) return '***'
  return `${s.slice(0, 2)}****${s.slice(-2)}`
}

export function maskName(name?: string | null): string | null {
  if (!name) return null
  const s = String(name).trim()
  if (!s) return null
  const parts = s.split(/\s+/)
  return parts.map(p => (p.length <= 2 ? p : `${p[0]}***`)).join(' ')
}

// Recursivamente reduz um objeto a um resumo mascarado para console.log.
// Mantém chaves estruturais (transactionId, status, event) intactas.
const SENSITIVE_KEYS = new Set([
  'email', 'buyer_email', 'buyerEmail',
  'phone', 'mobile', 'whatsapp', 'wa_id', 'waId', 'from_phone_number',
  'name', 'buyer_name', 'buyerName', 'full_name', 'fullName', 'pushname', 'firstName', 'lastName',
  'cpf', 'cnpj', 'document', 'documento',
  'address', 'street', 'cep', 'zip', 'zipcode',
  'access_token', 'accessToken', 'refresh_token', 'refreshToken',
  'password', 'token', 'hottok', 'apiKey', 'api_key', 'secret', 'webhookToken',
])

export function sanitizeForLog(value: any, depth = 0): any {
  if (value == null || depth > 6) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map(v => sanitizeForLog(v, depth + 1))
  if (typeof value !== 'object') return value
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase()
    if (SENSITIVE_KEYS.has(k) || SENSITIVE_KEYS.has(lower)) {
      if (lower.includes('email')) out[k] = maskEmail(v as any)
      else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('whatsapp') || lower.includes('wa')) out[k] = maskPhone(v as any)
      else if (lower.includes('name')) out[k] = maskName(v as any)
      else out[k] = '***'
    } else {
      out[k] = sanitizeForLog(v, depth + 1)
    }
  }
  return out
}
