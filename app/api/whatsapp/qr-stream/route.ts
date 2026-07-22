import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getSessions, getSession, sessionDir, broadcast, clearSessionFiles,
  type SessionInfo,
} from '@/lib/whatsapp-sessions'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const userId = session.user.id
  const sessions = getSessions()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      let existing = sessions.get(userId)

      if (existing && existing.status === 'open') {
        send('connected', { phone: existing.phone || '' })
        controller.close()
        return
      }

      if (!existing || existing.status === 'closed' || existing.status === 'error') {
        const newSession: SessionInfo = {
          status: 'connecting',
          controllers: new Set([controller]),
        }
        sessions.set(userId, newSession)
        existing = newSession
      } else {
        existing.controllers.add(controller)
        if (existing.status === 'qr' && existing.qr) {
          send('qr', { qr: existing.qr })
        }
        return
      }

      send('status', { status: 'connecting' })

      try {
        const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
          await import('@whiskeysockets/baileys')
        const { default: QRCode } = await import('qrcode')
        const { Boom } = await import('@hapi/boom')
        const { default: pino } = await import('pino')

        const authDir = sessionDir(userId)
        const { state, saveCreds } = await useMultiFileAuthState(authDir)
        const { version } = await fetchLatestBaileysVersion()

        const sock = makeWASocket({
          version,
          auth: state,
          printQRInTerminal: false,
          logger: pino({ level: 'silent' }),
          browser: ['FlowFunnel', 'Chrome', '120.0'],
          connectTimeoutMs: 60_000,
          qrTimeout: 60_000,
        })

        const currentSession = sessions.get(userId)!
        currentSession.sock = sock

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update
          const sess = sessions.get(userId)
          if (!sess) return

          if (qr) {
            try {
              const qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 })
              sess.status = 'qr'
              sess.qr = qrDataUrl
              broadcast(sess, 'qr', { qr: qrDataUrl })
            } catch {}
          }

          if (connection === 'open') {
            const rawPhone = sock.user?.id?.split(':')[0]?.split('@')[0] || ''
            const phone = rawPhone ? `+${rawPhone}` : ''

            sess.status = 'open'
            sess.phone = phone

            try {
              const allIntegrations = await prisma.integration.findMany({
                where: { userId, platform: 'WHATSAPP' },
              })
              const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
              const plan = user?.plan || 'FREE'
              const PLAN_LIMITS: Record<string, number> = { FREE: 1, START: 1, PRO: 3, SCALE: 999 }
              const limit = PLAN_LIMITS[plan] ?? 1

              const existingWithPhone = allIntegrations.find(i => {
                try { return JSON.parse(i.config || '{}').phoneNumberId === rawPhone } catch { return false }
              })

              if (existingWithPhone) {
                await prisma.integration.update({
                  where: { id: existingWithPhone.id },
                  data: {
                    accessToken: 'QR_CONNECTED',
                    isActive: true,
                    updatedAt: new Date(),
                    config: JSON.stringify({
                      phoneNumberId: rawPhone,
                      businessAccountId: 'QR_MODE',
                      connectedAt: new Date().toISOString(),
                      connectionType: 'SIMPLE',
                    }),
                  },
                })
              } else if (allIntegrations.length < limit) {
                await prisma.integration.create({
                  data: {
                    userId,
                    platform: 'WHATSAPP',
                    nickname: phone || `WhatsApp ${allIntegrations.length + 1}`,
                    accessToken: 'QR_CONNECTED',
                    isActive: true,
                    isDefault: allIntegrations.length === 0,
                    config: JSON.stringify({
                      phoneNumberId: rawPhone,
                      businessAccountId: 'QR_MODE',
                      connectedAt: new Date().toISOString(),
                      connectionType: 'SIMPLE',
                    }),
                  },
                })
              }
            } catch (dbErr) {
              console.error('DB error saving WhatsApp connection:', dbErr)
            }

            broadcast(sess, 'connected', { phone })

            for (const ctrl of sess.controllers) {
              try { ctrl.close() } catch {}
            }
            sess.controllers.clear()
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as InstanceType<typeof Boom>)?.output?.statusCode
            const loggedOut = statusCode === DisconnectReason.loggedOut
            const sess = sessions.get(userId)
            if (sess) {
              if (loggedOut) {
                clearSessionFiles(userId)
                sess.status = 'closed'
                broadcast(sess, 'error', { message: 'Sessão expirada, escaneie o QR novamente.' })
                sessions.delete(userId)
              } else {
                broadcast(sess, 'status', { status: 'reconnecting' })
              }
            }
          }
        })
      } catch (err) {
        const sess = sessions.get(userId)
        if (sess) {
          sess.status = 'error'
          broadcast(sess, 'error', { message: 'Erro ao iniciar sessão WhatsApp. Tente novamente.' })
          sessions.delete(userId)
        }
        console.error('WhatsApp session error:', err)
        try { controller.close() } catch {}
      }
    },

    cancel() {
      const sess = sessions.get(userId)
      if (sess) {
        sess.controllers.forEach(ctrl => { try { ctrl.close() } catch {} })
        sess.controllers.clear()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const userId = session.user.id
  const sess = getSessions().get(userId)
  if (sess?.sock) {
    try { await sess.sock.logout() } catch {}
  }
  clearSessionFiles(userId)
  getSessions().delete(userId)

  return NextResponse.json({ success: true })
}
