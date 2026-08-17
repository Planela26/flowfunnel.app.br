/**
 * Vencimento do período pago.
 *
 * O plano dura 30 dias a partir do pagamento aprovado, independentemente do dia
 * do mês em que foi pago — quem paga dia 8 vence dia 8 do mês seguinte, e quem
 * paga dia 28 tem os mesmos 30 dias, sem ser cortado pela virada do mês.
 *
 * Antes disso não havia vencimento nenhum: o webhook marcava a assinatura como
 * ativa e nada expirava, então um PIX avulso dava acesso permanente.
 *
 * Este módulo é separado de lib/trial.ts de propósito. Teste grátis e período
 * pago vencem por motivos diferentes e levam a telas diferentes — misturá-los
 * faria um cliente pagante vencido cair na tela de "seu teste acabou".
 */

export const DIAS_DO_CICLO = 30
const DIA_MS = 24 * 60 * 60 * 1000

export type PlanExpiryFields = {
  planExpiresAt?: Date | string | null
  subscriptionStatus?: string | null
}

/** Quando termina o período pago que começa agora. */
export function computePlanExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + DIAS_DO_CICLO * DIA_MS)
}

/**
 * Período pago acabou e não foi renovado.
 *
 * `null` devolve false de propósito: é o estado de quem pagou antes desta
 * coluna existir, ou de quem nunca pagou. Em nenhum dos dois casos faria
 * sentido bloquear por uma data que nunca foi gravada — o vencimento passa a
 * valer a partir do próximo pagamento aprovado.
 */
export function isPlanExpired(user: PlanExpiryFields | null | undefined): boolean {
  if (!user?.planExpiresAt) return false
  return new Date(user.planExpiresAt).getTime() <= Date.now()
}

/** Dias que faltam para vencer (0 se já venceu ou se não há período pago). */
export function planDaysLeft(planExpiresAt: Date | string | null | undefined): number {
  if (!planExpiresAt) return 0
  const diff = new Date(planExpiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / DIA_MS))
}

/**
 * Início do período corrente — usado pela cota de conversas.
 *
 * A cota zerava no dia 1º de cada mês, o que descolava do que o cliente pagou:
 * quem assinava dia 28 recebia cota nova três dias depois, ganhando dois
 * períodos por um pagamento. Ancorando no vencimento, o ciclo de uso passa a
 * ser exatamente o ciclo cobrado.
 *
 * Sem período pago, cai de volta para o mês corrente — é o comportamento
 * antigo, adequado para quem está no plano gratuito ou em teste.
 */
export function currentCycleStart(user: PlanExpiryFields | null | undefined, now: Date = new Date()): Date {
  if (user?.planExpiresAt) {
    const fim = new Date(user.planExpiresAt).getTime()
    if (fim > now.getTime()) {
      return new Date(fim - DIAS_DO_CICLO * DIA_MS)
    }
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/** Fim do período corrente — a data que a interface mostra como "renova em". */
export function currentCycleEnd(user: PlanExpiryFields | null | undefined, now: Date = new Date()): Date {
  if (user?.planExpiresAt) {
    const fim = new Date(user.planExpiresAt)
    if (fim.getTime() > now.getTime()) return fim
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

/**
 * Pode iniciar um novo pagamento?
 *
 * Regra do negócio: só quando o período atual vencer. Sem isso, alguém poderia
 * pagar duas vezes no mesmo mês por engano — e como cada cobrança no Mercado
 * Pago é avulsa (não há renovação automática nesta integração), o dinheiro
 * entraria sem que a segunda cobrança comprasse nada.
 */
export function canStartNewPayment(user: PlanExpiryFields | null | undefined): { allowed: true } | { allowed: false; reason: string; expiresAt: Date } {
  if (!user?.planExpiresAt) return { allowed: true }
  const fim = new Date(user.planExpiresAt)
  if (fim.getTime() <= Date.now()) return { allowed: true }

  const dias = planDaysLeft(fim)
  const quando = fim.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  return {
    allowed: false,
    expiresAt: fim,
    reason:
      `Seu plano está ativo até ${quando} (${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}). ` +
      'A renovação fica disponível quando o período atual terminar.',
  }
}
