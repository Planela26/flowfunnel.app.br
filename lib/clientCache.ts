'use client'

import { useEffect, useRef, useState } from 'react'

type CacheEntry<T> = {
  data: T
  ts: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
const subscribers = new Map<string, Set<() => void>>()

function notify(key: string) {
  const set = subscribers.get(key)
  if (!set) return
  for (const cb of set) cb()
}

async function revalidate<T>(url: string, init?: RequestInit): Promise<T | null> {
  const existing = inflight.get(url)
  if (existing) return existing as Promise<T | null>
  const p = fetch(url, init)
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return (await r.json()) as T
    })
    .then((data) => {
      cache.set(url, { data, ts: Date.now() })
      notify(url)
      return data
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(url)
    })
  inflight.set(url, p as Promise<unknown>)
  return p
}

export function getCached<T>(url: string): T | undefined {
  return cache.get(url)?.data as T | undefined
}

export function mutateCache<T>(url: string, data: T) {
  cache.set(url, { data, ts: Date.now() })
  notify(url)
}

export function invalidateCache(url: string) {
  cache.delete(url)
  notify(url)
}

type Options = {
  refreshIntervalMs?: number
  revalidateOnFocus?: boolean
}

export function useCachedJSON<T>(
  url: string | null,
  opts: Options = {}
): { data: T | undefined; refresh: () => Promise<T | null> } {
  const { refreshIntervalMs, revalidateOnFocus = true } = opts
  const [, setTick] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!url) return
    let set = subscribers.get(url)
    if (!set) {
      set = new Set()
      subscribers.set(url, set)
    }
    const cb = () => {
      if (mounted.current) setTick((t) => t + 1)
    }
    set.add(cb)
    // fire immediate revalidate (uses cache if present)
    revalidate<T>(url)
    let intervalId: ReturnType<typeof setInterval> | null = null
    if (refreshIntervalMs && refreshIntervalMs > 0) {
      intervalId = setInterval(() => revalidate<T>(url), refreshIntervalMs)
    }
    const onFocus = () => {
      // revalidate if cache older than 30s
      const entry = cache.get(url)
      if (!entry || Date.now() - entry.ts > 30_000) {
        revalidate<T>(url)
      }
    }
    if (revalidateOnFocus && typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus)
    }
    return () => {
      set?.delete(cb)
      if (set && set.size === 0) subscribers.delete(url)
      if (intervalId !== null) clearInterval(intervalId)
      if (revalidateOnFocus && typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus)
      }
    }
  }, [url, refreshIntervalMs, revalidateOnFocus])

  return {
    data: url ? (cache.get(url)?.data as T | undefined) : undefined,
    refresh: () => (url ? revalidate<T>(url) : Promise.resolve(null)),
  }
}
