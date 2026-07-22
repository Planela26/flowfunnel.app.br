'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    fbq?: (...args: any[]) => void
  }
}

export function MetaPixelTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
    window.fbq('track', 'PageView')
  }, [pathname, searchParams])

  return null
}
