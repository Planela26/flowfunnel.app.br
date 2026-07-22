import path from 'path'
import fs from 'fs'

export interface SessionInfo {
  status: 'connecting' | 'qr' | 'open' | 'closed' | 'error'
  qr?: string
  phone?: string
  sock?: any
  controllers: Set<ReadableStreamDefaultController>
}

declare global {
  var __waSessions: Map<string, SessionInfo> | undefined
}

export function getSessions(): Map<string, SessionInfo> {
  if (!global.__waSessions) {
    global.__waSessions = new Map()
  }
  return global.__waSessions
}

export function getSession(userId: string): SessionInfo | undefined {
  return getSessions().get(userId)
}

export function sessionDir(userId: string): string {
  const dir = path.join(process.cwd(), 'sessions', userId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function broadcast(session: SessionInfo, event: string, data: object) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const enc = new TextEncoder().encode(payload)
  for (const ctrl of session.controllers) {
    try { ctrl.enqueue(enc) } catch {}
  }
}

export function clearSessionFiles(userId: string) {
  const dir = path.join(process.cwd(), 'sessions', userId)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}
