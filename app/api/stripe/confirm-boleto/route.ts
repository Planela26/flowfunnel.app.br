import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUncachableStripeClient } from '@/lib/stripeClient'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/security-utils'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const rl = await checkRateLimit(`stripe:confirm-boleto:${session.user.id}`, 10, 60_000)
    if (!rl.ok) return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 })

    const { paymentIntentId, paymentMethodId } = await req.json()
    if (!paymentIntentId || !paymentMethodId) {
      return NextResponse.json({ error: 'paymentIntentId e paymentMethodId são obrigatórios' }, { status: 400 })
    }

    const stripe = await getUncachableStripeClient()

    const piCheck = await stripe.paymentIntents.retrieve(paymentIntentId as string)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })
    if (piCheck.customer !== user?.stripeCustomerId) {
      return NextResponse.json({ error: 'Pagamento não pertence a este usuário' }, { status: 403 })
    }

    const pi = await stripe.paymentIntents.confirm(paymentIntentId as string, {
      payment_method: paymentMethodId as string,
    })

    if (pi.next_action?.type === 'boleto_display_details') {
      const bd = pi.next_action.boleto_display_details as any
      return NextResponse.json({
        type: 'boleto',
        number: bd.number || '',
        expiresAt: bd.expires_at || 0,
        pdfUrl: bd.pdf || bd.hosted_voucher_url || '',
        voucherUrl: bd.hosted_voucher_url || '',
      })
    }

    if (pi.status === 'succeeded') {
      return NextResponse.json({ type: 'success' })
    }

    if (pi.status === 'requires_action') {
      return NextResponse.json({ type: 'requires_action', nextActionType: pi.next_action?.type })
    }

    return NextResponse.json({ type: 'unknown', status: pi.status })
  } catch (err: any) {
    console.error('confirm-boleto error:', err?.message)
    return NextResponse.json({ error: err?.message || 'Erro ao confirmar pagamento' }, { status: 500 })
  }
}
