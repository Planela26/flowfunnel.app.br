/**
 * Quando uma conta pode ser apagada de vez pelo painel de admin.
 *
 * A regra é comercial, não técnica: **conta viva não se apaga**. Só sai do ar
 * de forma definitiva quem parou de pagar e não renovou.
 *
 * O motivo é que a exclusão é irreversível e destrói em cascata tudo que o
 * cliente construiu — funis, leads, eventos, memórias da SARA, integrações.
 * Apagar por engano alguém que está pagando é um estrago que não tem desfazer
 * e que o cliente descobre no pior momento possível. A inadimplência funciona
 * aqui como uma trava natural: para uma conta chegar a ser apagável, ela
 * precisa antes ter deixado de pagar e atravessado a carência.
 *
 * Para suspender uma conta viva existe a desativação (reversível), que é o
 * caminho do dia a dia.
 *
 * O que NÃO trava a exclusão:
 *  - conta FREE que nunca assinou nem tem teste correndo (cadastro de spam,
 *    conta de teste, duplicata) — não há nada a perder nem cobrança em curso;
 *  - assinatura cancelada, expirada, estornada ou em disputa;
 *  - inadimplente com a carência de `past_due` já vencida.
 *
 * O que trava:
 *  - `subscriptionStatus === 'active'` — está pagando e vai renovar;
 *  - `past_due` DENTRO da carência — falhou a cobrança mas ainda pode se
 *    resolver sozinha; enquanto esse prazo corre, a conta não é "não renovou";
 *  - teste grátis em andamento — ainda é um cliente em avaliação.
 */

import { isSubscriptionBlocked, isInGracePeriod, graceDaysLeft } from './subscription'
import { isTrialActive, trialDaysLeft } from './trial'

export type DeletableAccount = {
  plan: string
  subscriptionStatus?: string | null
  gracePeriodEndsAt?: Date | string | null
  trialStatus?: string | null
  trialEndsAt?: Date | null
  trialPlan?: string | null
}

export type DeletionVerdict =
  | { allowed: true }
  | { allowed: false; reason: string }

export function canHardDeleteAccount(user: DeletableAccount): DeletionVerdict {
  if (user.subscriptionStatus === 'active') {
    return {
      allowed: false,
      reason:
        'Esta conta tem assinatura ativa. Só é possível apagar depois que ela ficar inadimplente e não renovar. ' +
        'Para suspender o acesso agora, use Desativar.',
    }
  }

  if (isInGracePeriod(user.subscriptionStatus, user.gracePeriodEndsAt)) {
    const dias = graceDaysLeft(user.gracePeriodEndsAt)
    return {
      allowed: false,
      reason:
        `O pagamento falhou, mas a conta ainda está na carência (${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}) ` +
        'e a cobrança pode ser recuperada. Só será possível apagar quando a carência vencer sem renovação. ' +
        'Para suspender o acesso agora, use Desativar.',
    }
  }

  if (isTrialActive(user)) {
    const dias = trialDaysLeft(user.trialEndsAt)
    return {
      allowed: false,
      reason:
        `Esta conta está com teste grátis em andamento (${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}). ` +
        'Só é possível apagar depois que o teste terminar sem conversão. Para suspender o acesso agora, use Desativar.',
    }
  }

  return { allowed: true }
}

/**
 * Rótulo curto do porquê a conta é apagável — usado no log de auditoria, para
 * que o registro guarde o estado comercial no momento da exclusão (a linha do
 * usuário deixa de existir logo em seguida).
 */
export function deletionEligibilityLabel(user: DeletableAccount): string {
  if (isSubscriptionBlocked(user.subscriptionStatus, user.gracePeriodEndsAt)) {
    return `inadimplente/${user.subscriptionStatus ?? 'sem_status'}`
  }
  if (!user.subscriptionStatus) return 'nunca_assinou'
  return user.subscriptionStatus
}
