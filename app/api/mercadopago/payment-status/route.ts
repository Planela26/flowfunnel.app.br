import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPayment } from '@/lib/mercadopago'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'

/**
 * Status de um pagamento — consultado em laço pelo checkout enquanto o QR do
 * PIX está na tela (a cada 3s, ver app/checkout/page.tsx).
 *
 * A defesa contra enumeração de IDs é a checagem de DONO abaixo, não o rate
 * limit. Apertar o limite não serve aqui: o laço legítimo já faz ~20 req/min,
 * então qualquer teto baixo o suficiente para atrapalhar um atacante corta
 * antes o cliente que está esperando a confirmação do PIX — e o laço engole o
 * 429 em silêncio (`if (!res.ok) return`), deixando quem pagou preso na tela.
 * O teto aqui é só contenção de abuso; quem separa um pagamento do outro é o
 * external_reference.
 */
export async function GET(request: Request) {
  try {
    const rl = await checkRateLimit(
      `mp:payment-status:${getClientIp(request.headers)}`,
      60,
      60_000
    )
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const paymentId = idParam ? parseInt(idParam, 10) : NaN
    if (!idParam || isNaN(paymentId) || paymentId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const payment = await getPayment(paymentId)

    // Só o dono lê o status. O external_reference é gravado por nós na criação
    // do pagamento como `${userId}:${plano}[:${afiliado}]` — comparar o prefixo
    // com a sessão impede varrer IDs (1, 2, 3…) atrás de pagamento alheio.
    //
    // O e-mail também é aceito como prefixo por causa dos pagamentos criados
    // antes desta correção, quando a referência caía para o e-mail se não
    // houvesse usuário logado. É o e-mail DA PRÓPRIA SESSÃO, então não abre
    // brecha; só evita que um pagamento em andamento no momento do deploy
    // pare de confirmar na tela.
    const ref = payment.external_reference
    const isOwner =
      !!ref &&
      (ref.startsWith(`${session.user.id}:`) ||
        (!!session.user.email && ref.startsWith(`${session.user.email}:`)))

    if (!isOwner) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })
    }

    const approved = payment.status === 'approved'
    const pending = payment.status === 'pending' || payment.status === 'in_process'

    return NextResponse.json({
      status: approved ? 'approved' : pending ? 'pending' : 'other',
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao consultar o pagamento.' }, { status: 500 })
  }
}
