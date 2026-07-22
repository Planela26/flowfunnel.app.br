import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Read-once endpoint for the browser Pixel on /checkout/success.
// Returns the pending Meta Purchase (written by the Stripe/Mercado Pago webhook
// ONLY after the payment is confirmed) and clears it so the Pixel fires exactly
// once. The returned eventId matches the CAPI event_id → Meta deduplicates.
//
// Atomically: single UPDATE ... RETURNING so concurrent reads can't double-fire.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Atomic consume-and-clear: one DB round-trip, row-level lock.
  const rows = await prisma.$queryRawUnsafe<{ metaPurchase: string | null }[]>(
    `UPDATE "User" SET "metaPurchase" = NULL WHERE id = $1 AND "metaPurchase" IS NOT NULL RETURNING "metaPurchase"`,
    session.user.id,
  )

  const raw = rows?.[0]?.metaPurchase ?? null
  if (!raw) {
    return NextResponse.json({ purchase: null })
  }

  let purchase: unknown = null
  try {
    purchase = JSON.parse(raw)
  } catch {
    purchase = null
  }

  return NextResponse.json({ purchase })
}
