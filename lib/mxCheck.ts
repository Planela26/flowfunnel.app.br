import { promises as dns } from 'dns'
import { domainToASCII } from 'url'

const CACHE = new Map<string, { ok: boolean; expiresAt: number }>()
const TTL_MS = 60 * 60 * 1000
const TIMEOUT_MS = 2000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('dns_timeout')), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

export async function emailDomainHasMx(email: string): Promise<boolean> {
  const at = email.lastIndexOf('@')
  if (at <= 0) return false
  const rawDomain = email.slice(at + 1).toLowerCase().trim()
  if (!rawDomain) return false

  let domain: string
  try {
    domain = domainToASCII(rawDomain) || rawDomain
  } catch {
    domain = rawDomain
  }

  const cached = CACHE.get(domain)
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.ok

  let ok = false
  try {
    const mx = await withTimeout(dns.resolveMx(domain), TIMEOUT_MS)
    ok = Array.isArray(mx) && mx.length > 0
  } catch {
    ok = false
  }
  CACHE.set(domain, { ok, expiresAt: now + TTL_MS })
  return ok
}

export async function emailHasValidMx(email: string): Promise<{ valid: boolean; reason?: 'format' | 'no_mx' | 'timeout' }> {
  const at = email.lastIndexOf('@')
  if (at <= 0) return { valid: false, reason: 'format' }

  const rawDomain = email.slice(at + 1).toLowerCase().trim()
  if (!rawDomain) return { valid: false, reason: 'format' }

  let domain: string
  try {
    domain = domainToASCII(rawDomain) || rawDomain
  } catch {
    domain = rawDomain
  }

  const cached = CACHE.get(domain)
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.ok ? { valid: true } : { valid: false, reason: 'no_mx' }

  try {
    const mx = await withTimeout(dns.resolveMx(domain), TIMEOUT_MS)
    const ok = Array.isArray(mx) && mx.length > 0
    CACHE.set(domain, { ok, expiresAt: now + TTL_MS })
    return ok ? { valid: true } : { valid: false, reason: 'no_mx' }
  } catch {
    CACHE.set(domain, { ok: false, expiresAt: now + TTL_MS })
    return { valid: false, reason: 'timeout' }
  }
}
