import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { logWebhook } from '@/lib/webhook-logger'
import { sanitizeForLog } from '@/lib/sanitize'
import { checkRateLimit, verifyHmacSignature } from '@/lib/security-utils'
import { guardWebhook } from '@/lib/webhook-security'
import { findIntegrationByWebhookToken } from '@/lib/webhook-tenant'
import { processHotmartEvent } from '@/lib/webhook-handlers'

// Tokenized Hotmart webhook URL: /api/webhooks/hotmart/<webhookToken>
// Each tenant has a unique webhookToken so the request unambiguously
// resolves to the correct user — eliminating cross-tenant attribution.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const startTime = Date.now()
  let body: any = null

  try {
    const { token } = await params
    const rl = await checkRateLimit(`webhook:hotmart:${token}`, 120, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    // HMAC precisa dos BYTES EXATOS recebidos (raw body), não JSON.stringify(parsed).
    const rawBody = await request.text()
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const integration = await findIntegrationByWebhookToken('HOTMART', token)
    if (!integration) {
      // Não há tenant para atribuir, então WebhookLog (que exige userId) não
      // pode registrar isto. O console é o único lugar possível — mas sem ele
      // uma URL errada no painel da Hotmart não deixava rastro NENHUM, nem no
      // servidor. O prefixo do token permite casar com a URL configurada lá.
      console.warn(
        `❌ [hotmart] webhook recebido com token desconhecido: ${token.slice(0, 8)}… ` +
        `(evento="${body?.event ?? '?'}") — a URL configurada na Hotmart não corresponde a nenhuma integração ativa`,
      )
      return NextResponse.json({ error: 'Invalid webhook token' }, { status: 404 })
    }

    const event = body.event
    const data = body.data
    if (!event || !data) {
      return NextResponse.json({ success: true, message: 'No event data' })
    }

    // `.trim()` nos dois lados: o valor é copiado e colado à mão em dois
    // painéis diferentes, e um "\n" invisível no fim produzia 403 em toda
    // entrega, sem nada na tela sugerindo espaço em branco como causa.
    const hottok = request.headers.get('X-Hotmart-Hottok')?.trim() || null
    const esperado = integration.accessToken?.trim() || null

    if (esperado && hottok !== esperado) {
      const requestId = request.headers.get('X-Request-ID') || undefined
      // O motivo exato, sem transportar nenhum dos dois valores. "A Hotmart não
      // mandou o cabeçalho" e "mandou um valor diferente" têm correções
      // opostas, e ambos saíam como o mesmo "Invalid hottok".
      const motivo = !hottok
        ? 'A Hotmart não enviou o cabeçalho X-Hotmart-Hottok nesta entrega, mas há um Hottok configurado aqui. Limpe o campo Token de Segurança em Configurações → Hotmart, ou preencha o Hottok no painel da Hotmart.'
        : `O Hottok recebido não confere com o configurado aqui (recebido: ${hottok.length} caracteres; configurado: ${esperado.length}). Copie o Hottok exibido na configuração do webhook na Hotmart e cole em Configurações → Hotmart.`
      await logWebhook({
        userId: integration.userId,
        platform: 'HOTMART',
        event: event || 'unknown',
        method: 'POST',
        endpoint: `/api/webhooks/hotmart/${token.slice(0, 8)}…`,
        payload: { event, summary: sanitizeForLog(data) },
        response: { error: 'Invalid hottok' },
        statusCode: 403,
        duration: Date.now() - startTime,
        error: motivo,
        requestId,
      })
      return NextResponse.json({ error: 'Forbidden', motivo }, { status: 403 })
    }

    // Hotmart: HMAC é opcional (hottok é a autenticação primária).
    const sig = request.headers.get('X-Hotmart-Signature')
    if (sig && process.env.HOTMART_WEBHOOK_SECRET && !verifyHmacSignature(rawBody, sig, process.env.HOTMART_WEBHOOK_SECRET)) {
      // Este 403 não gravava nada: quando ele era a causa, o painel da Hotmart
      // mostrava 403 e o app não tinha registro nenhum da entrega.
      const motivo = 'Assinatura X-Hotmart-Signature não confere com HOTMART_WEBHOOK_SECRET configurado no servidor.'
      await logWebhook({
        userId: integration.userId,
        platform: 'HOTMART',
        event: event || 'unknown',
        method: 'POST',
        endpoint: `/api/webhooks/hotmart/${token.slice(0, 8)}…`,
        payload: { event, summary: sanitizeForLog(data) },
        response: { error: 'Invalid signature' },
        statusCode: 403,
        duration: Date.now() - startTime,
        error: motivo,
        requestId: request.headers.get('X-Request-ID') || undefined,
      })
      return NextResponse.json({ error: 'Forbidden', motivo }, { status: 403 })
    }

    // Timestamp ±5min (se houver) + anti-replay.
    const guard = await guardWebhook({
      platform: `hotmart:${token}`,
      rawBody,
      signature: sig,
      secret: null,
      headers: request.headers,
    })
    if (!guard.ok) {
      if (guard.duplicate) return NextResponse.json({ success: true, duplicate: true })
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const resultado = await processHotmartEvent(event, data, integration.userId)

    const requestId = request.headers.get('X-Request-ID') || undefined
    // A resposta para a Hotmart continua 200 — não queremos que ela reenvie um
    // evento que decidimos não gravar. Mas o LOG precisa dizer a verdade: um
    // evento descartado por conta vencida ficava indistinguível de um evento
    // processado, e o card zerado não tinha explicação em lugar nenhum.
    await logWebhook({
      userId: integration.userId,
      platform: 'HOTMART',
      event,
      method: 'POST',
      endpoint: `/api/webhooks/hotmart/${token.slice(0, 8)}…`,
      requestId,
      payload: sanitizeForLog(body),
      response: { success: true, ingerido: resultado.ingerido },
      statusCode: 200,
      duration: Date.now() - startTime,
      error: resultado.ingerido
        ? undefined
        : resultado.motivo === 'conta_vencida'
          ? 'Evento recebido mas NÃO gravado: plano vencido, ingestão pausada'
          : `Evento recebido mas NÃO gravado: "${event}" não é tratado`,
    })

    return NextResponse.json({ success: true, ingerido: resultado.ingerido })
  } catch (error: any) {
    console.error('Erro no webhook Hotmart (tokenized):', error)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}
