import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { resolveCommercialAccess } from './commercial-access'

/**
 * Camada comercial das integrações.
 *
 * Conectar Meta, WhatsApp, Eduzz, Hotmart, Kiwify, Monetizze ou Perfect Pay é
 * funcionalidade do produto: quem não tem direito de acesso não conecta. O que
 * mudou não foi a existência do bloqueio, e sim a resposta.
 *
 * ANTES: qualquer motivo de recusa saía como `card_required`, com o texto
 * "Você está conhecendo a plataforma. Adicione um cartão". Cliente que pagou
 * PIX e passou dos 30 dias recebia esse convite em vez de um botão de renovar;
 * conta desativada recebia o mesmo; a conta administrativa também.
 *
 * AGORA: o motivo é explícito — `plan_expired`, `subscription_required` ou
 * `account_deactivated` — e cada um leva a uma tela diferente. `card_required`
 * não é mais emitido pelo FlowSara em lugar nenhum: se esse código aparecer na
 * interface, veio da Graph API da Meta e é problema de cobrança DA CONTA DE
 * ANÚNCIOS, não de autorização daqui.
 *
 * Retorna `null` quando a operação é permitida; caso contrário, uma
 * `NextResponse` pronta para o caller devolver.
 */
export async function assertCanCreateIntegration(
  _request: Request,
): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Faça login para conectar uma integração.' },
      { status: 401 },
    )
  }

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      // Papel: a conta administrativa não é barrada pelo fluxo comercial.
      role: true,
      // Suspensão administrativa — precede qualquer consideração de pagamento.
      deactivatedAt: true,
      subscriptionStatus: true,
      paymentMethodAddedAt: true,
      gracePeriodEndsAt: true,
      // Fim do período pago de 30 dias.
      planExpiresAt: true,
      // Regras do teste grátis.
      plan: true,
      trialStatus: true,
      trialEndsAt: true,
      trialPlan: true,
    },
  })
  if (!u) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Conta não encontrada. Entre novamente.' },
      { status: 401 },
    )
  }

  const decisao = resolveCommercialAccess(u)
  if (decisao.allowed) return null

  return NextResponse.json(
    {
      error: decisao.code,
      message: decisao.message,
      upgradeUrl: decisao.actionUrl,
    },
    { status: decisao.status },
  )
}
