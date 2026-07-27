import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSaleOrigin } from '@/lib/journey'

// GET /api/attribution/sale/:transactionId — "de onde veio esta venda?"
// Retorna a atribuição + jornada completa do lead vinculado (se houver).
export async function GET(_request: Request, { params }: { params: { transactionId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const result = await getSaleOrigin(session.user.id, params.transactionId)
  if (!result) {
    return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
  }
  return NextResponse.json(result)
}
