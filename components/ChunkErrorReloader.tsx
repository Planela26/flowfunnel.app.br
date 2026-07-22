'use client'

import { useEffect } from 'react'

const KEY = 'flowfunnel:chunk-reload-at'
const COOLDOWN_MS = 10_000

function isChunkError(err: unknown): boolean {
  if (!err) return false
  const msg =
    typeof err === 'string'
      ? err
      : (err as any)?.message || (err as any)?.reason?.message || ''
  const name =
    (err as any)?.name || (err as any)?.reason?.name || ''
  if (!msg && !name) return false
  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Failed to load chunk/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  )
}

function maybeReload() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || '0')
    if (Date.now() - last < COOLDOWN_MS) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {}
  window.location.reload()
}

export default function ChunkErrorReloader() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.error) || isChunkError(e.message)) maybeReload()
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) maybeReload()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
