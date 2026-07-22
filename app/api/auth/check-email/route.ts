import { NextResponse } from 'next/server'
import { emailDomainHasMx } from '@/lib/mxCheck'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(request: Request) {
  const ip = getClientIp(request.headers)

  const rl = await checkRateLimit(`check-email:${ip}`, 30, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ valid: false, reason: 'rate_limited' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const email = String(searchParams.get('email') || '').toLowerCase().trim()

  if (!email) return NextResponse.json({ valid: false, reason: 'empty' })
  if (!EMAIL_REGEX.test(email)) return NextResponse.json({ valid: false, reason: 'format' })

  const ok = await emailDomainHasMx(email)
  return NextResponse.json(ok ? { valid: true } : { valid: false, reason: 'no_mx' })
}
