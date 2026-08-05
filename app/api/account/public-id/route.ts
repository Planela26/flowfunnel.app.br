/**
 * GET  /api/account/public-id — retorna (e gera se necessário) o publicId do usuário autenticado.
 *
 * O ID público é gerado lazy: na primeira chamada, se o usuário ainda não tiver um,
 * ele é criado, persistido e retornado. Isso garante retrocompatibilidade com usuários
 * existentes sem causar uma migration de backfill pesada.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { IdGeneratorService } from '@/lib/id-generator'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { publicId: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Já tem publicId — retorna direto
    if (user.publicId) {
      return NextResponse.json({ publicId: user.publicId })
    }

    // Geração lazy: primeira vez que o usuário acessa
    // Tenta até MAX_ATTEMPTS vezes para tratar colisão no INSERT (race condition)
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const publicId = await IdGeneratorService.generateAccountId()
        // Update condicionado a publicId ainda ser null: evita que duas requisições
        // concorrentes (ex.: StrictMode disparando o efeito 2x, ou duas abas abertas)
        // gerem IDs diferentes e a última sobrescreva silenciosamente a primeira.
        const { count } = await prisma.user.updateMany({
          where: { id: session.user.id, publicId: null },
          data:  { publicId },
        })
        if (count === 0) {
          // Outra requisição já gravou um publicId nesse meio-tempo — usa o valor persistido.
          const current = await prisma.user.findUnique({
            where:  { id: session.user.id },
            select: { publicId: true },
          })
          return NextResponse.json({ publicId: current?.publicId ?? null })
        }
        return NextResponse.json({ publicId })
      } catch (err: any) {
        // Código Postgres de violação de unique constraint
        if (err?.code === 'P2002' && attempt < 4) continue
        throw err
      }
    }

    return NextResponse.json({ error: 'Não foi possível gerar o ID FlowSara' }, { status: 500 })
  } catch (err) {
    console.error('[public-id GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
