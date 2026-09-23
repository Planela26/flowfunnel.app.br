/**
 * Passa o porteiro de novo sobre o histórico de vendas já gravado.
 *
 * Roda sozinha sempre que o vínculo de produtos de um funil muda (ver
 * app/api/workspaces), então este endpoint é o caminho manual: serve para
 * quando a pessoa quer conferir, para vendas que chegaram antes de a coluna
 * existir, e para depois de uma correção feita direto no banco.
 *
 * Reexecutar é seguro — o cálculo é o mesmo e o resultado converge.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { reorganizarHistoricoHotmart } from '@/lib/porteiro-funil'
import { checkRateLimit } from '@/lib/security-utils'
import { cache } from '@/lib/cache'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // A reorganização varre o histórico inteiro da conta. Sem limite, um clique
  // repetido no botão enfileira varreduras e derruba o banco para os outros.
  const rl = await checkRateLimit(`reorganizar:${session.user.id}`, 3, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Espere um minuto antes de reorganizar de novo.' },
      { status: 429 },
    )
  }

  try {
    const resultado = await reorganizarHistoricoHotmart(session.user.id)

    // Sem isto o card continuaria mostrando os números velhos por até dois
    // minutos, e o botão pareceria não ter feito nada — a pior leitura
    // possível de um botão que acabou de mover vendas de funil.
    cache.invalidatePattern(new RegExp('^' + session.user.id + ':'))

    return NextResponse.json({
      ok: true,
      ...resultado,
      mensagem:
        resultado.atualizados === 0
          ? 'Tudo já estava no funil certo.'
          : `${resultado.atualizados} venda(s) reorganizada(s)` +
            (resultado.semFunil > 0 ? `, ${resultado.semFunil} ficou(aram) em "Sem funil".` : '.'),
    })
  } catch (e) {
    console.error('[porteiro] reorganização manual falhou:', e)
    return NextResponse.json({ error: 'Erro ao reorganizar' }, { status: 500 })
  }
}
