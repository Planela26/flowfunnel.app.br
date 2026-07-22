import crypto from 'crypto'
import { META_PIXEL_IDS, META_GRAPH_VERSION } from './meta-pixels'

// ─── Meta Conversion API (CAPI) ──────────────────────────────────────────
// Server-side event delivery to the Meta Conversions API. Sends each event to
// ALL configured pixels using a single META_ACCESS_TOKEN. Fails gracefully
// (no-op + warning) when the token is missing so the rest of the flow never
// breaks. The same `eventId` MUST be used by the browser Pixel for the same
// logical event so Meta deduplicates Pixel ↔ CAPI automatically.

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://flowfunnel.com.br')

let warnedMissingToken = false

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/** Normalize + SHA-256 an email (lowercase, trimmed). Returns undefined if empty. */
function hashEmail(email?: string | null): string | undefined {
  if (!email) return undefined
  const normalized = email.trim().toLowerCase()
  if (!normalized) return undefined
  return sha256(normalized)
}

/** Normalize + SHA-256 a phone number (digits only). Returns undefined if empty. */
function hashPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (!digits) return undefined
  return sha256(digits)
}

export interface MetaUserData {
  email?: string | null
  phone?: string | null
  clientIp?: string | null
  userAgent?: string | null
  fbp?: string | null // _fbp browser cookie
  fbc?: string | null // _fbc browser cookie
  externalId?: string | null // e.g. userId (will be hashed)
}

export interface MetaCustomData {
  value?: number
  currency?: string
  [key: string]: unknown
}

export interface SendMetaEventArgs {
  eventName: string
  eventId: string
  userData: MetaUserData
  customData?: MetaCustomData
  eventSourceUrl?: string
  actionSource?: 'website' | 'system_generated' | 'app' | 'other'
  eventTime?: number // unix seconds
}

/**
 * Send a server-side event to the Meta Conversions API for every configured
 * pixel. Returns a summary; never throws (errors are logged and swallowed so
 * billing/auth flows are never blocked by tracking).
 */
export async function sendMetaCapiEvent(args: SendMetaEventArgs): Promise<{ ok: boolean; skipped?: boolean }> {
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!accessToken) {
    if (!warnedMissingToken) {
      console.warn(
        '⚠️ [meta-capi] META_ACCESS_TOKEN ausente — eventos CAPI NÃO serão enviados. Configure o token para ativar a Conversion API.',
      )
      warnedMissingToken = true
    }
    return { ok: false, skipped: true }
  }

  const { eventName, eventId, userData, customData, eventSourceUrl, actionSource = 'website' } = args
  const eventTime = args.eventTime ?? Math.floor(Date.now() / 1000)

  // Build hashed user_data per Meta spec.
  const user_data: Record<string, unknown> = {}
  const em = hashEmail(userData.email)
  if (em) user_data.em = [em]
  const ph = hashPhone(userData.phone)
  if (ph) user_data.ph = [ph]
  if (userData.externalId) user_data.external_id = [sha256(String(userData.externalId))]
  if (userData.clientIp) user_data.client_ip_address = userData.clientIp
  if (userData.userAgent) user_data.client_user_agent = userData.userAgent
  if (userData.fbp) user_data.fbp = userData.fbp
  if (userData.fbc) user_data.fbc = userData.fbc

  const eventPayload: Record<string, unknown> = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: actionSource,
    event_source_url: eventSourceUrl || SITE_URL,
    user_data,
  }
  if (customData && Object.keys(customData).length > 0) {
    eventPayload.custom_data = customData
  }

  const body = JSON.stringify({ data: [eventPayload] })

  const results = await Promise.allSettled(
    META_PIXEL_IDS.map(async (pixelId) => {
      const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?access_token=${accessToken}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`pixel ${pixelId} → HTTP ${res.status}: ${text.slice(0, 300)}`)
      }
      return pixelId
    }),
  )

  let anyOk = false
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      anyOk = true
      console.log(`✅ [meta-capi] ${eventName} (event_id=${eventId}) enviado → pixel ${r.value}`)
    } else {
      console.error(`❌ [meta-capi] ${eventName} (event_id=${eventId}) falhou:`, r.reason?.message || r.reason)
    }
  })

  return { ok: anyOk }
}

/** Read Meta browser cookies (_fbp / _fbc) from a request's Cookie header. */
export function readFbCookies(headers: Headers): { fbp?: string; fbc?: string } {
  const cookie = headers.get('cookie') || ''
  const out: { fbp?: string; fbc?: string } = {}
  for (const part of cookie.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === '_fbp') out.fbp = decodeURIComponent(v.join('='))
    if (k === '_fbc') out.fbc = decodeURIComponent(v.join('='))
  }
  return out
}
