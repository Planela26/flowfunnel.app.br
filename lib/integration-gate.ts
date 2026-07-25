import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { hasPaidAccess } from './trial'

/**
 * Bloqueia criação de integração quando o usuário está no modo "só explorar"
 * (sem cartão na Stripe E sem assinatura ativa).
 *
 * Sem cartão cadastrado, o usuário pode navegar pelo funil, ver exemplos e
 * configurar o que quiser — mas não pode adicionar Meta Ads, Google Ads,
 * TikTok, WhatsApp, Eduzz, Kiwify, Hotmart, Monetizze ou Perfect Pay.
 *
 * Quem pagou via PIX (MercadoPago) já tem `subscriptionStatus='active'`
 * aplicado pelo webhook → passa direto.
 *
 * Retorna `null` se a operação é permitida; caso contrário retorna uma
 * `NextResponse` 402 pronta para o caller devolver.
 */
export async function assertCanCreateIntegration(
  request: Request,
): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionStatus: true, paymentMethodAddedAt: true, plan: true },
  })
  if (!u) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  if (hasPaidAccess(u)) return null

  return NextResponse.json(
    {
      error: 'card_required',
      code: 'CARD_REQUIRED_TO_LINK_INTEGRATION',
      message:
        'Você está conhecendo a plataforma. Adicione um cartão de crédito (teste grátis de 7 dias, sem cobrança até o fim do período) ou pague via PIX para liberar a conexão de integrações reais.',
      upgradeUrl: '/billing',
    },
    { status: 402 },
  )
}
