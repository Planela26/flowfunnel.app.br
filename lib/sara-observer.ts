/**
 * SaraObserver — observador de eventos do sistema para a Sara.AI.
 *
 * Monitoramento proativo de eventos críticos da plataforma.
 * Quando eventos relevantes ocorrem, o Observer cria SaraInsights
 * que ficam disponíveis para o usuário e para a Sara.
 *
 * Arquitetura event-driven: novos eventos são adicionados facilmente
 * criando um novo EventType e registrando o handler correspondente.
 *
 * Para chamar de qualquer lugar:
 *   import { SaraObserver } from '@/lib/sara-observer'
 *   await SaraObserver.emit('webhook_failed', userId, { platform, errorCount })
 */

import { prisma } from '@/lib/prisma'
import { SaraContextService } from './sara-context-service'

// ── Event types ───────────────────────────────────────────────────────────────

export type ObserverEventType =
  | 'webhook_failed'           // Webhook recebeu erro repetido
  | 'integration_disconnected' // Integração desativada/autenticação expirada
  | 'campaign_drop'            // Queda brusca em campanha
  | 'funnel_abandonment_spike' // Pico de abandono no funil
  | 'payment_rejected'         // Pagamento recusado do usuário
  | 'metric_anomaly'           // Anomalia detectada em métricas
  | 'ticket_spike'             // Muitos tickets abertos de repente
  | 'high_error_rate'          // Taxa de erro elevada

export type InsightSeverity = 'info' | 'warning' | 'critical'

export interface ObserverEvent {
  type:     ObserverEventType
  userId:   string
  payload?: Record<string, unknown>
}

// ── Severity map ──────────────────────────────────────────────────────────────

const EVENT_SEVERITY: Record<ObserverEventType, InsightSeverity> = {
  webhook_failed:           'warning',
  integration_disconnected: 'critical',
  campaign_drop:            'warning',
  funnel_abandonment_spike: 'warning',
  payment_rejected:         'critical',
  metric_anomaly:           'info',
  ticket_spike:             'warning',
  high_error_rate:          'critical',
}

// ── Title/description generators ─────────────────────────────────────────────

function buildInsightContent(event: ObserverEvent): { title: string; description: string } {
  const p = event.payload ?? {}

  switch (event.type) {
    case 'webhook_failed':
      return {
        title:       `Webhook com falhas — ${p.platform ?? 'plataforma desconhecida'}`,
        description: `${p.errorCount ?? 'Múltiplos'} erros detectados no webhook de ${p.platform ?? 'integração'}. ` +
                     `Verifique a URL e o HMAC Secret configurados na plataforma.`,
      }
    case 'integration_disconnected':
      return {
        title:       `Integração desconectada — ${p.platform ?? 'plataforma'}`,
        description: `A integração com ${p.platform ?? 'plataforma'} foi desativada ou a autenticação expirou. ` +
                     `Reconecte para retomar o recebimento de eventos.`,
      }
    case 'campaign_drop':
      return {
        title:       `Queda detectada na campanha`,
        description: `A campanha ${p.campaignName ?? ''} apresentou queda de ${p.dropPercent ?? '?'}% ` +
                     `em ${p.metric ?? 'conversões'}. Revise o criativo e o orçamento.`,
      }
    case 'funnel_abandonment_spike':
      return {
        title:       `Pico de abandono no funil`,
        description: `Taxa de abandono aumentou ${p.increasePercent ?? '?'}% na etapa "${p.stageName ?? '?'}". ` +
                     `Verifique sua página de checkout e fluxo de mensagens.`,
      }
    case 'payment_rejected':
      return {
        title:       `Pagamento recusado`,
        description: `Houve uma falha no processamento do pagamento. ` +
                     `Verifique os dados do cartão ou tente outra forma de pagamento.`,
      }
    case 'metric_anomaly':
      return {
        title:       `Anomalia em métricas detectada`,
        description: `${p.description ?? 'Uma variação incomum foi detectada nas suas métricas.'}`,
      }
    case 'ticket_spike':
      return {
        title:       `Volume elevado de chamados`,
        description: `${p.count ?? 'Vários'} chamados foram abertos recentemente sobre "${p.topic ?? 'tópico recorrente'}". ` +
                     `A Sara.AI pode estar identificando um problema sistêmico.`,
      }
    case 'high_error_rate':
      return {
        title:       `Taxa de erros elevada`,
        description: `${p.description ?? 'Foi detectada uma taxa anormal de erros na plataforma.'}`,
      }
    default:
      return {
        title:       'Evento do sistema',
        description: JSON.stringify(p).slice(0, 200),
      }
  }
}

// ── Observer service ──────────────────────────────────────────────────────────

export const SaraObserver = {

  /**
   * Emite um evento e persiste um SaraInsight correspondente.
   * Silencioso em caso de erro — nunca deve bloquear o fluxo principal.
   */
  async emit(type: ObserverEventType, userId: string, payload?: Record<string, unknown>): Promise<void> {
    try {
      const event    = { type, userId, payload }
      const severity = EVENT_SEVERITY[type] ?? 'info'
      const { title, description } = buildInsightContent(event)

      await prisma.saraInsight.create({
        data: {
          userId,
          type,
          title,
          description,
          severity,
          data: payload ? JSON.stringify(payload) : null,
        },
      })

      // Invalida o contexto para que a próxima resposta inclua o novo insight
      SaraContextService.invalidate(userId)
    } catch (err) {
      // Falha silenciosa — o Observer nunca deve quebrar o fluxo principal
      console.error('[SaraObserver] emit failed (non-blocking):', err)
    }
  },

  /**
   * Retorna insights não lidos de um usuário.
   */
  async getUnread(userId: string, limit = 10) {
    return prisma.saraInsight.findMany({
      where:   { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    })
  },

  /**
   * Marca insight(s) como lido.
   */
  async markRead(userId: string, insightId?: string): Promise<void> {
    await prisma.saraInsight.updateMany({
      where: { userId, ...(insightId ? { id: insightId } : {}) },
      data:  { isRead: true },
    })
  },
}
