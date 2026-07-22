import { NextResponse } from 'next/server'
import { getStripePublishableKey } from '@/lib/stripeClient'

export async function GET() {
  try {
    const publishableKey = await getStripePublishableKey()
    return NextResponse.json({ publishableKey })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
