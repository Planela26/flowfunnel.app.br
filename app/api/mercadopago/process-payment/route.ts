import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBaseUrl } from '@/lib/base-url'
import { prismaAdmin as prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'
import { createPayment, getPlanPrice, getPlanName } from '@/lib/mercadopago'
import { Plan } from '@/lib/plans'
import { randomUUID } from 'crypto'
import { getAttributionAffiliateId } from '@/lib/affiliate-attribution'
import { canStartNewPayment } from '@/lib/plan-expiry'
import { registrarEventoProprio, EVENTOS } from '@/lib/owner-funnel'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PLAN_KEYS: Record<string, Plan> = {
  START: 'START',
  PRO: 'PRO',
  SCALE: 'SCALE',
}

export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(
      `mp:process-payment:${getClientIp(request.headers)}`,
      10,
      60_000
    )
    if (!rl.ok) {
      return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      plan,
      couponCode,
      idempotencyKey,
      // Payment Brick formData
      token,
      payment_method_id,
      issuer_id,
      installments,
      payer,
      lead_id,
    } = body

    // Identificador da jornada vindo da landing. Só formato é validado — o
    // valor é opaco e serve apenas para reencontrar a visita depois.
    const leadId = typeof lead_id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(lead_id)
      ? lead_id
      : null

    // Idempotency key is generated client-side per checkout attempt and reused on
    // retries/double-submits so Mercado Pago dedups them. Fall back to a fresh UUID
    // if the client didn't send a valid one.
    const idemKey = typeof idempotencyKey === 'string' && UUID_RE.test(idempotencyKey)
      ? idempotencyKey
      : randomUUID()

    const planKey = plan?.toUpperCase()
    const planName = PLAN_KEYS[planKey]
    if (!planName) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    if (!payment_method_id) {
      return NextResponse.json({ error: 'Método de pagamento ausente' }, { status: 400 })
    }

    const basePrice = getPlanPrice(planName)
    if (basePrice === 0) {
      return NextResponse.json({ error: 'Plano não disponível para pagamento' }, { status: 400 })
    }

    // Renovação só quando o período atual vencer.
    //
    // Cada cobrança no Mercado Pago é avulsa — não há renovação automática
    // nesta integração. Sem esta trava, alguém que pagasse de novo por engano
    // dentro do período teria o dinheiro debitado sem comprar nada: o novo
    // pagamento apenas reiniciaria a contagem de 30 dias, jogando fora os dias
    // que restavam. A checagem é no servidor porque a tela pode ser contornada.
    const assinante = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { planExpiresAt: true },
    })
    const podePagar = canStartNewPayment(assinante)
    if (!podePagar.allowed) {
      return NextResponse.json(
        { error: 'plan_still_active', message: podePagar.reason },
        { status: 409 },
      )
    }

    // Cookie de atribuição verificado (Fase 3, §18/§24.4) — nunca lemos
    // affiliateId do corpo. Mesmo padrão de app/api/mercadopago/create-preference.
    const cookieAffiliateId = getAttributionAffiliateId(request)

    // Desconto: cupom digitado manualmente tem prioridade; na ausência dele,
    // cai para o afiliado rastreado pelo cookie. Não decide atribuição de
    // comissão — isso é resolvido separadamente, depois do userId.
    let discountPercent = 0
    let discountResolved = false
    if (couponCode) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { code: couponCode.toUpperCase() },
        select: { discountPercent: true, status: true },
      })
      if (affiliate && affiliate.status === 'ACTIVE') {
        discountPercent = Number(affiliate.discountPercent)
        discountResolved = true
      }
    }
    if (!discountResolved && cookieAffiliateId) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: cookieAffiliateId },
        select: { discountPercent: true, status: true },
      })
      if (affiliate && affiliate.status === 'ACTIVE') {
        discountPercent = Number(affiliate.discountPercent)
      }
    }

    // Arredonda em centavos, não em reais: com preços terminados em ,90 o
    // Math.round simples devolvia o valor inteiro e engolia os centavos.
    const finalPrice = discountPercent > 0
      ? Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100
      : basePrice

    // Autenticado via middleware + getServerSession check acima — sempre tem user
    const userId = session.user.id
    const payerEmail = session.user.email!
    const payerName = session.user.name || undefined

    // Atribuição de comissão — Fase 3 (§18/§24.4). Prioridade:
    // User.referredByAffiliateId já congelado > cookie ff_attr > null.
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredByAffiliateId: true },
    })
    let validAffiliateId: string | null = existingUser?.referredByAffiliateId ?? null

    if (!validAffiliateId) validAffiliateId = cookieAffiliateId

    const webhookBase = getBaseUrl()

    // Referência externa: `userId:plano:afiliado:jornada`.
    //
    // O lead_id entra como QUARTO segmento, sempre na mesma posição (vazio
    // quando não há), porque é o que sobrevive à volta pelo webhook. Guardar
    // numa tabela nossa não resolveria o pagamento com cartão, que não gera
    // registro intermediário — a referência externa é o único campo que o
    // Mercado Pago devolve intacto em todos os métodos.
    //
    // O parser do webhook lê por índice e trata segmento vazio como ausente,
    // então referências antigas de 2 ou 3 partes continuam funcionando.
    const externalRef = leadId
      ? `${userId}:${planKey}:${validAffiliateId ?? ''}:${leadId}`
      : validAffiliateId
      ? `${userId}:${planKey}:${validAffiliateId}`
      : `${userId}:${planKey}`

    // Build payer for the payment.
    //
    // O e-mail vem SEMPRE da sessão — nunca de `payer.email` do corpo. Era essa
    // a brecha: quem enviasse `payer.email` de terceiro gerava cobrança em nome
    // da vítima. O `payer` do corpo só é lido para a identificação (CPF).
    //
    // O CPF, sim, precisa vir do formulário: o Mercado Pago exige
    // `payer.identification` para boleto e PIX no Brasil, e esse dado não está
    // no cadastro — quem digita é o titular, no Payment Brick. Não é campo de
    // identidade aqui (a cobrança já está presa ao userId/e-mail da sessão),
    // então aceitá-lo do corpo não reabre a brecha.
    const paymentPayer: any = {
      email: payerEmail,
    }
    if (payer?.identification?.number) {
      paymentPayer.identification = {
        type: payer.identification.type === 'CNPJ' ? 'CNPJ' : 'CPF',
        number: String(payer.identification.number).replace(/\D/g, ''),
      }
    }
    if (payerName) {
      const [firstName, ...rest] = payerName.split(' ')
      paymentPayer.first_name = firstName
      if (rest.length) paymentPayer.last_name = rest.join(' ')
    }

    const paymentInput: any = {
      transaction_amount: finalPrice,
      description: getPlanName(planName),
      payment_method_id,
      payer: paymentPayer,
      external_reference: externalRef,
      notification_url: `${webhookBase}/api/webhooks/mercadopago`,
    }

    // Card payments include a token + installments + issuer
    if (token) {
      paymentInput.token = token
      paymentInput.installments = installments || 1
      if (issuer_id) paymentInput.issuer_id = issuer_id
    }

    // PIX vale por 24h.
    //
    // Sem definir, vale o padrão do Mercado Pago — e o lembrete de uma hora
    // depois poderia entregar um copia-e-cola já expirado, o que piora a
    // experiência em vez de recuperar a venda. Com 24h, o código do e-mail
    // certamente ainda funciona, e quem só volta no dia seguinte ainda paga.
    if (payment_method_id === 'pix') {
      const expira = new Date(Date.now() + 24 * 60 * 60 * 1000)
      paymentInput.date_of_expiration = expira.toISOString().replace('Z', '+00:00')
    }

    const payment = await createPayment(paymentInput, idemKey)

    // Registra a cobrança PIX para o lembrete de não pagos (cron/pix-reminder).
    //
    // Só PIX: cartão resolve na hora e boleto tem o próprio fluxo do banco.
    // Falhar aqui não pode derrubar a resposta — a cobrança já existe no
    // Mercado Pago e o cliente precisa ver o QR; perder o lembrete é o dano
    // menor. Por isso o catch silencioso (com log).
    // Eventos da jornada própria — separando o que costuma ser confundido.
    //
    // `payment_started` significa que a cobrança foi CRIADA, e `pix_generated`
    // que o QR existe. Nenhum dos dois é venda: quem gera PIX e não paga fica
    // exatamente aqui, e é essa distância que revela o gargalo real. A compra
    // só é registrada pelo webhook, mediante confirmação do Mercado Pago.
    if (leadId) {
      const ehPix = !!payment.point_of_interaction?.transaction_data?.qr_code
      registrarEventoProprio({
        leadId,
        evento: ehPix ? EVENTOS.pixGenerated : EVENTOS.paymentStarted,
        url: `${webhookBase}/checkout?plan=${planKey}`,
        metadata: {
          paymentId: String(payment.id),
          plano: planKey,
          valor: finalPrice,
          moeda: 'BRL',
          metodo: payment_method_id,
          status: payment.status,
        },
      }).catch(() => {})
    }

    const qrCode = payment.point_of_interaction?.transaction_data?.qr_code || null
    if (qrCode) {
      try {
        await prisma.pixCharge.upsert({
          where: { paymentId: String(payment.id) },
          update: {},
          create: {
            userId,
            paymentId: String(payment.id),
            plan: planKey,
            amount: finalPrice,
            qrCode,
            ticketUrl: payment.point_of_interaction?.transaction_data?.ticket_url || null,
          },
        })
      } catch (e) {
        console.error('[process-payment] falha ao registrar PixCharge:', e)
      }
    }

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
      payment_type_id: payment.payment_type_id,
      discountPercent,
      finalPrice,
      // PIX data
      qr_code: payment.point_of_interaction?.transaction_data?.qr_code || null,
      qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url || null,
      // Boleto data
      boleto_url: payment.transaction_details?.external_resource_url || null,
    })
  } catch (error: any) {
    console.error('Erro ao processar pagamento Mercado Pago:', error)
    return NextResponse.json(
      { error: 'Erro ao processar o pagamento. Tente novamente.' },
      { status: 500 }
    )
  }
}
