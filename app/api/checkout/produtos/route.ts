import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Produtos que JÁ apareceram nas vendas da conta, por plataforma.
 *
 * Serve o seletor de "quais produtos este funil acompanha". A lista sai do
 * próprio histórico em vez de uma chamada à API de cada plataforma: assim ela
 * funciona sem token válido, sem depender de a integração estar de pé, e mostra
 * exatamente os produtos que o filtro tem como separar — se um produto nunca
 * apareceu numa venda, vinculá-lo não mudaria número nenhum, e oferecê-lo seria
 * prometer uma separação que não acontece.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const funis = await prisma.funnel.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (funis.length === 0) return NextResponse.json({ produtos: {} })

    const eventos = await prisma.funnelEvent.findMany({
      where: {
        funnelId: { in: funis.map((f) => f.id) },
        source: { in: ['hotmart', 'kiwify', 'eduzz', 'monetizze', 'perfect_pay'] },
      },
      select: { source: true, metadata: true },
      orderBy: { timestamp: 'desc' },
      // Teto para não varrer o histórico inteiro só para montar uma lista: os
      // produtos ativos aparecem nas vendas recentes.
      take: 2000,
    })

    // { hotmart: [{ id, nome, vendas }], ... }
    const porPlataforma: Record<string, Map<string, { id: string; nome: string; vendas: number }>> = {}

    for (const ev of eventos) {
      const plataforma = ev.source || 'desconhecida'
      let meta: any = {}
      try { meta = JSON.parse(ev.metadata || '{}') } catch { continue }

      const id = meta?.productId ?? meta?.product_id ?? meta?.produto_id
      if (id == null) continue
      const chave = String(id)

      if (!porPlataforma[plataforma]) porPlataforma[plataforma] = new Map()
      const atual = porPlataforma[plataforma].get(chave)
      if (atual) {
        atual.vendas++
        // Nome mais recente ganha: produto renomeado na plataforma deve
        // aparecer com o nome de hoje, não com o da primeira venda.
        if (!atual.nome && meta?.productName) atual.nome = String(meta.productName)
      } else {
        porPlataforma[plataforma].set(chave, {
          id: chave,
          nome: meta?.productName ? String(meta.productName) : `Produto ${chave}`,
          vendas: 1,
        })
      }
    }

    const produtos: Record<string, Array<{ id: string; nome: string; vendas: number }>> = {}
    for (const [plataforma, mapa] of Object.entries(porPlataforma)) {
      produtos[plataforma] = [...mapa.values()].sort((a, b) => b.vendas - a.vendas)
    }

    return NextResponse.json({ produtos })
  } catch (error) {
    console.error('[checkout/produtos] falha ao listar produtos:', error)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
  }
}
