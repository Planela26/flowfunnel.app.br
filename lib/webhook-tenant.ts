import crypto from 'crypto'
import { prismaAdmin as prisma } from './prisma'

export type IntegrationPlatform =
  | 'HOTMART'
  | 'KIWIFY'
  | 'EDUZZ'
  | 'MONETIZZE'
  | 'PERFECT_PAY'

export function generateWebhookToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

export async function ensureWebhookToken(integrationId: string): Promise<string> {
  const existing = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { webhookToken: true },
  })
  if (existing?.webhookToken) return existing.webhookToken
  const token = generateWebhookToken()
  await prisma.integration.update({
    where: { id: integrationId },
    data: { webhookToken: token },
  })
  return token
}

export async function findIntegrationByWebhookToken(
  platform: IntegrationPlatform,
  token: string | null | undefined,
) {
  if (!token || typeof token !== 'string') return null
  const integration = await prisma.integration.findUnique({
    where: { webhookToken: token },
  })
  if (!integration) return null
  if (integration.platform !== platform) return null
  if (!integration.isActive) return null
  return integration
}

/**
 * Backwards-compat lookup for legacy webhook URLs without a token.
 * Returns the active integration ONLY if exactly one tenant has the platform
 * connected; otherwise returns ambiguous=true so the route can refuse safely
 * and avoid attributing data to the wrong tenant.
 */
export async function findSingleActiveIntegration(platform: IntegrationPlatform) {
  const list = await prisma.integration.findMany({
    where: { platform, isActive: true },
    take: 2,
  })
  if (list.length === 0) return { integration: null, ambiguous: false }
  if (list.length > 1) return { integration: null, ambiguous: true }
  return { integration: list[0], ambiguous: false }
}

/**
 * Hotmart-specific: each tenant has its own HOTTOK stored in `accessToken`.
 * The HOTTOK arrives in the X-Hotmart-Hottok header, so we can identify the
 * right tenant on the legacy URL. Since uniqueness is not enforced at the DB
 * level, we explicitly refuse (ambiguous=true) if more than one active tenant
 * shares the same hottok — never attribute data to an arbitrary tenant.
 */
export async function findHotmartIntegrationByHottok(hottok: string | null) {
  if (!hottok) return { integration: null, ambiguous: false }
  const list = await prisma.integration.findMany({
    where: { platform: 'HOTMART', isActive: true, accessToken: hottok },
    take: 2,
  })
  if (list.length === 0) return { integration: null, ambiguous: false }
  if (list.length > 1) return { integration: null, ambiguous: true }
  return { integration: list[0], ambiguous: false }
}

export function buildWebhookUrl(platform: string, token: string, baseUrl?: string | null) {
  const slug = platform.toLowerCase().replace(/_/g, '-')
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || ''
  return `${base}/api/webhooks/${slug}/${token}`
}

/**
 * Regenera o token de webhook de uma integração. O token antigo é invalidado
 * imediatamente — a integração passa a ter um novo token único.
 * Retorna o novo token.
 */
export async function regenerateWebhookToken(integrationId: string): Promise<string> {
  const newToken = generateWebhookToken()
  await prisma.integration.update({
    where: { id: integrationId },
    data: { webhookToken: newToken },
  })
  return newToken
}
