'use client'

import { useEffect } from 'react'
import { META_PIXEL_IDS } from '@/lib/meta-pixels'

declare global {
  interface Window {
    fbq?: (...args: any[]) => void
  }
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Meta Advanced Matching — when a user is logged in, re-init both pixels with
 * the SHA-256-hashed email (and phone if available) so subsequent Pixel events
 * carry advanced matching parameters. Server-side CAPI already hashes em/ph.
 *
 * Retries with exponential backoff until `window.fbq` is ready (the pixel script
 * loads asynchronously). If the user is not logged in, exits immediately.
 */
export function MetaAdvancedMatching() {
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 8

    const run = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        if (!res.ok) return
        const session = await res.json()
        const email: string | undefined = session?.user?.email
        const phone: string | undefined = session?.user?.phone
        if (!email) return

        if (cancelled || typeof window === 'undefined') return

        // Wait for fbq to be available (pixel script loads asynchronously).
        if (typeof window.fbq !== 'function') {
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(run, Math.min(500 * attempts, 3000))
          }
          return
        }

        const am: Record<string, string> = {}
        am.em = await sha256Hex(email.trim().toLowerCase())
        if (phone) {
          const digits = phone.replace(/\D/g, '')
          if (digits) am.ph = await sha256Hex(digits)
        }

        if (cancelled) return
        for (const id of META_PIXEL_IDS) {
          window.fbq('init', id, am)
        }
      } catch {
        // best-effort — never block the page
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  return null
}
