import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    }
  }
  if ((session.user as any).role !== 'ADMIN') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 }),
    }
  }
  return { ok: true, userId: session.user.id }
}
