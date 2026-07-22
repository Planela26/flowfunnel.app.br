import crypto from 'crypto'
import { prismaAdmin as prisma } from './prisma'
import { verifyHmacSignature } from './security-utils'

// Janela permitida para timestamp (±5 minutos) — usada na proteção anti-replay.
const REPLAY_WINDOW_MS = 5 * 60_000

export type WebhookGuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string; duplicate?: boolean }

// Fingerprint determinístico (sha256) usado como chave de replay. Guarda o HASH
// — nunca a assinatura crua — de plataforma + (assinatura || raw body).
function fingerprint(platform: string, signature: string | null, rawBody: string): string {
  const basis = signature && signature.length > 0 ? signature : rawBody
  return crypto.createHash('sha256').update(`${platform}:${basis}`).digest('hex')
}

// Tenta extrair um timestamp do webhook (header ou corpo). Best-effort: se não
// houver timestamp confiável, retorna null e a validação de janela é pulada.
function extractTimestamp(rawBody: string, headers: Headers): number | null {
  const headerTs =
    headers.get('x-webhook-timestamp') ||
    headers.get('x-timestamp') ||
    headers.get('x-request-timestamp')
  if (headerTs) {
    const n = Number(headerTs)
    if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n
  }
  try {
    const b = JSON.parse(rawBody)
    const cand =
      b.timestamp ?? b.created_at ?? b.createdAt ?? b.event_date ?? b.date ?? b.time
    if (cand != null) {
      if (typeof cand === 'number') return cand < 1e12 ? cand * 1000 : cand
      const t = Date.parse(String(cand))
      if (!Number.isNaN(t)) return t
    }
  } catch {
    /* corpo não-JSON ou inválido — ignora */
  }
  return null
}

// Guarda de segurança para webhooks de pagamento:
//   1. valida HMAC sobre o RAW BODY (bytes exatos) quando há secret configurado
//   2. valida timestamp dentro de ±5min quando disponível
//   3. detecta replay atomicamente via unique constraint
// Deve ser chamada com o raw body (await request.text()) ANTES de JSON.parse.
export async function guardWebhook(opts: {
  platform: string
  rawBody: string
  signature: string | null
  secret?: string | null
  headers: Headers
  /**
   * Quando true, o secret é OBRIGATÓRIO (fail-closed): se não estiver
   * configurado, o webhook é REJEITADO (503) e um alerta é logado, em vez de
   * aceitar payloads não assinados. Usado nas plataformas de pagamento
   * (Eduzz/Kiwify/Monetizze/Perfect Pay) para garantir HMAC em 100% das chamadas.
   */
  requireSecret?: boolean
}): Promise<WebhookGuardResult> {
  const { platform, rawBody, signature, secret, headers, requireSecret } = opts

  // 0) Fail-closed: secret obrigatório quando a rota o exige. Sem secret →
  //    NÃO processa, registra alerta no log e devolve 503 (config inválida).
  if (requireSecret && (!secret || secret.length === 0)) {
    console.error(
      `🚨 [webhook-security] ALERTA: segredo de webhook AUSENTE para "${platform}". ` +
        `Webhook REJEITADO (fail-closed). Configure o *_WEBHOOK_SECRET correspondente ` +
        `antes de divulgar a URL desta integração.`,
    )
    return { ok: false, status: 503, error: 'Webhook secret not configured' }
  }

  // 1) HMAC com raw body. Com requireSecret garantimos que o secret existe;
  //    sem ele, valida apenas quando o secret estiver presente.
  if (secret) {
    if (!signature || !verifyHmacSignature(rawBody, signature, secret)) {
      return { ok: false, status: 403, error: 'Invalid signature' }
    }
  }

  // 2) Timestamp ±5min (quando o webhook fornece um).
  const ts = extractTimestamp(rawBody, headers)
  if (ts != null) {
    if (Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
      return { ok: false, status: 401, error: 'Timestamp outside allowed window' }
    }
  }

  // 3) Replay detection — insert atômico; conflito (P2002) = reenvio.
  const fp = fingerprint(platform, signature, rawBody)
  try {
    await prisma.webhookReplayProtection.create({
      data: { platform, signature: fp, timestamp: ts ? new Date(ts) : null },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return { ok: false, status: 200, error: 'Duplicate webhook (replay)', duplicate: true }
    }
    // Falha de persistência não pode derrubar webhook legítimo — apenas loga.
    console.error('guardWebhook replay store error:', e?.message || e)
  }

  // Limpeza oportunística (1% das chamadas) de fingerprints com mais de 7 dias.
  if (Math.random() < 0.01) {
    prisma.webhookReplayProtection
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60_000) } } })
      .catch(() => {})
  }

  return { ok: true }
}
