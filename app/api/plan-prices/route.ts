import { NextResponse } from 'next/server'
import { getPlanPrice, getPlanName } from '@/lib/mercadopago'
import { Plan } from '@/lib/plans'

export async function GET() {
  const plans: Plan[] = ['START', 'PRO', 'SCALE']

  const prices = plans.map(plan => ({
    plan,
    price: getPlanPrice(plan),
    name: getPlanName(plan),
  }))

  return NextResponse.json({ prices })
}
