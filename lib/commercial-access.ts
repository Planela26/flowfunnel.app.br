/**
 * Direito comercial de uso — quem pode acionar funcionalidade paga.
 *
 * Fonte ÚNICA da decisão "esta conta pode conectar integração / usar recurso
 * pago?". Antes a resposta era um booleano solto (`hasPaidAccess`), e um
 * booleano não consegue dizer POR QUE negou: todos os motivos — nunca assinou,
 * plano venceu, conta desativada — saíam como o mesmo `card_required`, com o
 * texto "Você está conhecendo a plataforma. Adicione um cartão". Um cliente que
 * pagou PIX e passou dos 30 dias recebia esse convite a conhecer a plataforma
 * em vez de um botão de renovar.
 *
 * Por isso a decisão agora é um objeto com código semântico. Quem chama traduz
 * o código em status HTTP e tela de destino; ninguém precisa reconstruir o
 * raciocínio a partir de um `false`.
 *
 * Compõe os módulos que já existem, sem duplicar regra:
 *   - lib/plan-expiry.ts  → o período pago de 30 dias acabou?
 *   - lib/subscription.ts → o status da assinatura bloqueia? há carência?
 *   - lib/trial.ts        → o teste grátis ainda vale?
 */

import { isPlanExpired } from './plan-expiry'
import { isInGracePeriod, isSubscriptionBlocked } from './subscription'
import { isTrialActive, isTrialExpired, type TrialUser } from './trial'

/**
 * Papéis com acesso administrativo. `role` é String livre no schema
 * (prisma/schema.prisma:19), então a lista fica aqui em vez de num enum.
 */
export const PAPEIS_ADMIN = ['ADMIN', 'OWNER']

/**
 * Códigos de recusa. `account_deactivated` e `plan_expired` são os mesmos que o
 * middleware já emite (middleware.ts:205 e :270) — de propósito: a mesma
 * situação precisa ter o mesmo nome, venha a resposta de onde vier.
 * `subscription_required` é novo, e cobre o que antes saía como `card_required`.
 */
export type AccessDenialCode =
  | 'account_deactivated'
  | 'plan_expired'
  | 'subscription_required'

/** Por que o acesso foi concedido — vai para o log de auditoria, não para a tela. */
export type AccessGrantReason =
  | 'admin'
  | 'subscription_active'
  | 'grace_period'
  | 'trial_with_payment_method'

export type CommercialAccessUser = {
  role?: string | null
  deactivatedAt?: Date | string | null
  subscriptionStatus?: string | null
  paymentMethodAddedAt?: Date | string | null
  gracePeriodEndsAt?: Date | string | null
  planExpiresAt?: Date | string | null
  trialStatus?: string | null
  trialEndsAt?: Date | string | null
  trialPlan?: string | null
  plan?: string | null
}

export type AccessDecision =
  | { allowed: true; reason: AccessGrantReason }
  | {
      allowed: false
      code: AccessDenialCode
      /** Frase para a pessoa. O `code` é para a máquina; este campo é o que a tela mostra. */
      message: string
      /** Para onde mandar quem foi bloqueado. */
      actionUrl: string
      /** HTTP sugerido: 403 para suspensão, 402 para pendência comercial. */
      status: 402 | 403
    }

/**
 * Decide o direito comercial de uma conta.
 *
 * A ordem das checagens é a regra de negócio, e cada passo existe por um
 * motivo — ver os comentários. Mudar a ordem muda qual mensagem a pessoa
 * recebe, mesmo que o "pode ou não pode" continue igual.
 */
export function resolveCommercialAccess(user: CommercialAccessUser | null | undefined): AccessDecision {
  if (!user) {
    return {
      allowed: false,
      code: 'subscription_required',
      message: 'Não foi possível confirmar os dados da sua conta. Entre novamente e tente de novo.',
      actionUrl: '/billing',
      status: 402,
    }
  }

  // [1] Suspensão vem antes de tudo, inclusive de admin: conta desativada é
  // decisão administrativa e não se contorna por papel nem por pagamento.
  if (user.deactivatedAt) {
    return {
      allowed: false,
      code: 'account_deactivated',
      message: 'Sua conta está desativada. Fale com o suporte para reativá-la.',
      actionUrl: '/conta-desativada',
      status: 403,
    }
  }

  // [2] Papel administrativo. A plataforma precisa conseguir conectar as
  // próprias contas para operar e testar — o Laboratório, por exemplo, cruza
  // custo e ROAS a partir da integração Meta da conta fundadora. Sem esta
  // saída, o dono do produto era barrado pelo fluxo comercial do próprio
  // produto. É regra por PAPEL, não por identidade: nenhum e-mail aparece aqui.
  if (user.role && PAPEIS_ADMIN.includes(user.role)) {
    return { allowed: true, reason: 'admin' }
  }

  // [3] Período pago vencido — ANTES de olhar `subscriptionStatus`, porque o
  // webhook grava 'active' na aprovação e nada nunca reverte esse status (ver
  // lib/plan-expiry.ts). Sem esta trava, um PIX avulso virava acesso vitalício.
  //
  // O que estava errado não era esta precedência, e sim o destino: quem cai
  // aqui JÁ PAGOU e precisa renovar. Mandá-lo para o fluxo de "adicione um
  // cartão para começar seu teste" é que era o defeito.
  if (isPlanExpired(user)) {
    return {
      allowed: false,
      code: 'plan_expired',
      message: 'Seu plano venceu. Renove para voltar a conectar e sincronizar integrações.',
      actionUrl: '/plano-vencido',
      status: 402,
    }
  }

  // [4] Assinatura paga em dia — Stripe ou PIX/MercadoPago. O webhook do MP
  // grava 'active' na aprovação, então PIX libera na hora.
  if (user.subscriptionStatus === 'active') {
    return { allowed: true, reason: 'subscription_active' }
  }

  // [5] Carência de inadimplência: o pagamento falhou mas os 3 dias ainda
  // correm. Continua liberado de propósito — cobrar de novo é o caminho, tirar
  // o acesso de quem só teve um cartão recusado não é.
  if (isInGracePeriod(user.subscriptionStatus, user.gracePeriodEndsAt)) {
    return { allowed: true, reason: 'grace_period' }
  }

  // [6] Assinatura em estado que bloqueia. Aqui separamos "tinha e caiu" de
  // "não tem mais nenhuma": past_due fora da carência é uma cobrança que ficou
  // para trás (renovar); cancelada, expirada, estornada ou contestada não têm o
  // que renovar (assinar de novo).
  if (isSubscriptionBlocked(user.subscriptionStatus, user.gracePeriodEndsAt)) {
    if (user.subscriptionStatus === 'past_due' || user.subscriptionStatus === 'expired') {
      return {
        allowed: false,
        code: 'plan_expired',
        message: 'Seu pagamento não foi confirmado e o prazo de regularização acabou. Renove para reativar as integrações.',
        actionUrl: '/plano-vencido',
        status: 402,
      }
    }
    return {
      allowed: false,
      code: 'subscription_required',
      message: 'Sua assinatura não está ativa. Assine um plano para conectar integrações.',
      actionUrl: '/billing',
      status: 402,
    }
  }

  // [7] Nunca assinou (`subscriptionStatus` nulo). Sobra o teste grátis — e a
  // pergunta certa aqui é "EXISTE teste em vigor agora?", não "o teste
  // venceu?".
  //
  // A diferença não é sutil: `isTrialExpired` devolve `false` para vários
  // estados que não são teste nenhum — `pending_payment`, `pending_email`,
  // `converted`, `none` sem `trialPlan`, e qualquer conta com `trialEndsAt`
  // nulo. Perguntando pelo negativo, todos esses caíam na saída liberada.
  // Somado a `paymentMethodAddedAt`, que é gravado uma vez e NUNCA é limpo
  // (nenhuma rota do sistema zera essa coluna), o resultado era acesso
  // permanente: bastava ter cadastrado um cartão um dia.
  //
  // `isTrialActive` é o predicado positivo — exige `trialEndsAt` no futuro E
  // um teste de fato em curso. É o mesmo que `getEffectivePlan` já usa para
  // decidir o plano em vigor, então plano exibido e acesso concedido passam a
  // responder à mesma pergunta.
  const trial: TrialUser = {
    plan: user.plan ?? 'FREE',
    trialEndsAt: user.trialEndsAt ? new Date(user.trialEndsAt) : null,
    trialPlan: user.trialPlan,
    trialStatus: user.trialStatus,
  }

  if (!isTrialActive(trial)) {
    // Mensagem diferente para quem teve teste e perdeu — a pessoa sabe que
    // usou, e "comece seu teste grátis" soaria como se nada tivesse acontecido.
    const jaTeve = Boolean(user.trialEndsAt) || isTrialExpired(trial)
    return {
      allowed: false,
      code: 'subscription_required',
      message: jaTeve
        ? 'Seu teste grátis terminou. Assine um plano para voltar a usar as integrações.'
        : 'Para conectar uma conta real, comece seu teste grátis com cartão ou pague via PIX.',
      actionUrl: '/billing',
      status: 402,
    }
  }

  // [8] Teste em vigor, mas sem meio de pagamento: é modo explorar. A regra
  // comercial do teste não mudou — só vale como teste de verdade, cancelável
  // antes da cobrança, se houver cartão cadastrado. Sem ele a pessoa navega o
  // produto inteiro, mas não conecta conta real.
  //
  // Esta checagem vem DEPOIS da anterior de propósito: assim o cartão apenas
  // qualifica um direito que já existe, e nunca cria um sozinho.
  if (!user.paymentMethodAddedAt) {
    return {
      allowed: false,
      code: 'subscription_required',
      message: 'Para conectar uma conta real, adicione um cartão para iniciar seu teste grátis ou pague via PIX.',
      actionUrl: '/billing',
      status: 402,
    }
  }

  // [9] Teste em curso, com meio de pagamento — é o trial financeiro de fato.
  return { allowed: true, reason: 'trial_with_payment_method' }
}

/**
 * Versão booleana, para a UI que só quer saber "libera ou não".
 *
 * Vive aqui, e não em lib/trial.ts como antes, porque a decisão não é sobre
 * teste grátis: teste é UM dos caminhos de acesso. Mantê-la ao lado do
 * resolvedor garante que tela e gate nunca respondam coisas diferentes — foi
 * exatamente essa divergência que produziu o `card_required` para quem pagou.
 */
export function hasPaidAccess(user: CommercialAccessUser | null | undefined): boolean {
  return resolveCommercialAccess(user).allowed
}
