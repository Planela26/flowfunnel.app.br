import { NextResponse } from 'next/server'
import { getPayment } from '@/lib/mercadopago'
import { checkRateLimit, getClientIp } from '@/lib/security-utils'

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

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const paymentId = idParam ? parseInt(idParam, 10) : NaN
    if (!idParam || isNaN(paymentId) || paymentId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const payment = await getPayment(paymentId)

    const approved = payment.status === 'approved'
    const pending = payment.status === 'pending' || payment.status === 'in_process'

    return NextResponse.json({
      status: approved ? 'approved' : pending ? 'pending' : 'other',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
