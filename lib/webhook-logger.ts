import { prismaAdmin as prisma } from '@/lib/prisma'

interface WebhookLogData {
  userId: string
  platform: 'WHATSAPP' | 'HOTMART' | 'META_ADS'
  event: string
  method: string
  endpoint: string
  headers?: any
  payload?: any
  response?: any
  statusCode?: number
  duration?: number
  error?: string
  requestId?: string
  ipAddress?: string
  userAgent?: string
}

export async function logWebhook(data: WebhookLogData) {
  try {
    await prisma.webhookLog.create({
      data: {
        userId: data.userId,
        platform: data.platform,
        event: data.event,
        method: data.method,
        endpoint: data.endpoint,
        headers: data.headers ? JSON.stringify(data.headers) : null,
        payload: data.payload ? JSON.stringify(data.payload) : null,
        response: data.response ? JSON.stringify(data.response) : null,
        statusCode: data.statusCode || 200,
        duration: data.duration,
        error: data.error,
        requestId: data.requestId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    })
  } catch (error) {
    console.error('Erro ao salvar log de webhook:', error)
  }
}

export async function getWebhookStats(userId: string) {
  try {
    const last24h = new Date()
    last24h.setHours(last24h.getHours() - 24)

    const [total, errors, last24hCount, avgDuration] = await Promise.all([
      prisma.webhookLog.count({ where: { userId } }),
      prisma.webhookLog.count({
        where: { userId, statusCode: { gte: 400 } },
      }),
      prisma.webhookLog.count({
        where: { userId, createdAt: { gte: last24h } },
      }),
      prisma.webhookLog.aggregate({
        where: { userId, duration: { not: null } },
        _avg: { duration: true },
      }),
    ])

    return {
      total,
      errors,
      errorRate: total > 0 ? ((errors / total) * 100).toFixed(2) : '0',
      last24h: last24hCount,
      avgDuration: avgDuration._avg.duration?.toFixed(0) || '0',
    }
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error)
    return null
  }
}
