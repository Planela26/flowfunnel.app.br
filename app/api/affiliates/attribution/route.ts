import { NextResponse } from 'next/server'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { getAttributionAffiliateId } from '@/lib/affiliate-attribution'

// GET /api/affiliates/attribution — pré-visualização, SOMENTE para a UI do
// checkout mostrar/pré-aplicar o desconto (Fase 3). Lê e verifica o cookie
// ff_attr (httpOnly) no servidor e devolve só os dados públicos do afiliado
// resolvido — nunca o cookie, a assinatura ou o segredo. Esta rota não
// decide comissão nem é usada por nenhuma rota de checkout para atribuição:
// isso continua resolvido separadamente e exclusivamente no servidor
// (User.referredByAffiliateId > cookie ff_attr > null), lendo o cookie de
// novo ali, nunca confiando na resposta desta rota como prova.
export async function GET(request: Request) {
  try {
    const rl = await checkRateLimit(`affiliates:attribution:${getClientIp(request.headers)}`, 30, 60_000)
    if (!rl.ok) {
      return NextResponse.json({ attributed: false }, { status: 429 })
    }

    const affiliateId = getAttributionAffiliateId(request)
    if (!affiliateId) {
      return NextResponse.json({ attributed: false })
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: { code: true, name: true, discountPercent: true, status: true },
    })

    // Afiliado pode ter sido bloqueado depois do clique que gerou o cookie —
    // não mostra desconto de um cupom que não vai mais funcionar de fato.
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      return NextResponse.json({ attributed: false })
    }

    return NextResponse.json({
      attributed: true,
      affiliate: {
        code: affiliate.code,
        name: affiliate.name,
        discountPercent: Number(affiliate.discountPercent),
      },
    })
  } catch {
    // Fail-closed: qualquer erro inesperado é tratado como "sem atribuição",
    // nunca vaza detalhe de erro numa rota pública.
    return NextResponse.json({ attributed: false })
  }
}
