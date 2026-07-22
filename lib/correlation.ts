import { AsyncLocalStorage } from 'async_hooks'
import crypto from 'crypto'

// ── Correlation ID (requestId) para rastreamento end-to-end ────────────
// Usado em webhooks, APIs, logs e jobs para facilitar auditoria e debugging.

const als = new AsyncLocalStorage<{ requestId: string }>()

export function generateRequestId(): string {
  return crypto.randomUUID()
}

export function getRequestId(): string | undefined {
  return als.getStore()?.requestId
}

export function runWithRequestId<T>(
  fn: () => Promise<T>,
  requestId?: string,
): Promise<T> {
  const id = requestId || generateRequestId()
  return als.run({ requestId: id }, fn)
}

/** Adiciona requestId ao objeto de log/dados, se existir no contexto */
export function withRequestId<T extends object>(data: T): T & { requestId?: string } {
  const rid = getRequestId()
  return rid ? { ...data, requestId: rid } : data
}
