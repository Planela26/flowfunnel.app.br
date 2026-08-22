/**
 * Account access status — read-only mode for expired/blocked accounts.
 *
 * Em vez de bloquear toda a plataforma quando o plano vence (teste grátis
 * expirado ou assinatura paga cancelada/expirada/past_due fora da carência),
 * o usuário continua vendo e navegando por TODOS os dados já existentes. O que
 * muda é que a ENTRADA de novos dados (webhooks/leads/conversões) é interrompida
 * até a assinatura ser renovada — modo somente leitura.
 */

import { isSubscriptionBlocked } from './subscription'
import { isTrialExpiredForToken } from './auth-trial'
import { isPlanExpired } from './plan-expiry'
import { PAPEIS_ADMIN } from './commercial-access'
import { prismaAdmin } from './prisma'

export type AccountStatusFields = {
  subscriptionStatus?: string | null
  gracePeriodEndsAt?: Date | string | null
  trialStatus?: string | null
  trialEndsAt?: Date | null
  trialPlan?: string | null
  plan?: string | null
  planExpiresAt?: Date | string | null
}

/**
 * Retorna true quando a conta está vencida: teste grátis expirado OU assinatura
 * paga inativa (cancelada/expirada/past_due além da carência). Contas FREE que
 * nunca assinaram nem ativaram teste NÃO são consideradas vencidas.
 */
export function isAccountExpired(user: AccountStatusFields | null): boolean {
  if (!user) return false
  // Período pago de 30 dias terminado sem renovação (ver lib/plan-expiry.ts).
  // Entra aqui para que a ingestão de webhooks/tracker pare junto — sem isso,
  // uma conta vencida continuaria consumindo cota e recebendo dados de graça.
  if (isPlanExpired(user)) return true
  if (isSubscriptionBlocked(user.subscriptionStatus, user.gracePeriodEndsAt)) return true
  if (isTrialExpiredForToken(user)) return true
  return false
}

/**
 * Versão que consulta o banco — usada nas rotas de ingestão (webhooks/tracker)
 * para decidir se devemos PARAR de processar novos dados do tenant.
 *
 * Fail-open: em erro transitório de banco, NÃO derruba a ingestão (retorna false)
 * para evitar perder dados de clientes pagantes por uma falha pontual.
 */
export async function isIngestionBlockedForUser(
  userId: string | null | undefined,
): Promise<boolean> {
  return (await motivoDaPausaDeIngestao(userId)) !== null
}

/**
 * O MESMO cálculo, mas devolvendo o porquê.
 *
 * `isIngestionBlockedForUser` responde sim/não, e era só isso que existia: o
 * webhook descartava o evento e nem ele nem a interface sabiam dizer a razão.
 * A rota de diagnóstico precisa do motivo para explicar em português por que a
 * venda não entrou. Um único cálculo, duas leituras — se fossem dois, um dia
 * discordariam.
 *
 * Fail-open: em erro transitório de banco devolve `null` (não pausa), para não
 * perder dados de cliente pagante por uma falha pontual.
 */
export type MotivoDaPausa = 'plano_vencido' | 'assinatura_inativa' | 'teste_expirado'

export async function motivoDaPausaDeIngestao(
  userId: string | null | undefined,
): Promise<MotivoDaPausa | null> {
  if (!userId) return null
  try {
    const user = await prismaAdmin.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        subscriptionStatus: true,
        gracePeriodEndsAt: true,
        trialStatus: true,
        trialEndsAt: true,
        trialPlan: true,
        plan: true,
        planExpiresAt: true,
      },
    })
    if (!user) return null
    // ADMIN/OWNER nunca têm a ingestão pausada, pela mesma razão que passam
    // pelo portão comercial (lib/commercial-access.ts): a conta administrativa
    // não tem assinatura e cairia como "vencida" por um estado de teste que
    // nunca se aplicou a ela. Sem isto, os dois módulos discordam — o portão
    // deixa conectar a integração e a ingestão descarta tudo que ela recebe.
    if (user.role && PAPEIS_ADMIN.includes(user.role)) return null

    // A ordem espelha `isAccountExpired`.
    if (isPlanExpired(user)) return 'plano_vencido'
    if (isSubscriptionBlocked(user.subscriptionStatus, user.gracePeriodEndsAt)) return 'assinatura_inativa'
    if (isTrialExpiredForToken(user)) return 'teste_expirado'
    return null
  } catch (e) {
    console.error('[account-status] erro ao checar ingestão; fail-open:', e)
    return null
  }
}
