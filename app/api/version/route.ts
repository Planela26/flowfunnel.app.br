import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { estatisticasDeConexao } from '@/lib/prisma'

/**
 * Qual build está rodando agora.
 *
 * Existe para responder "o deploy entrou?" sem depender do painel. Hoje isso é
 * cego de fora: quase tudo que muda está atrás de sessão ou de assinatura, e as
 * tentativas de inferir pelo comportamento falharam uma a uma — o hash do chunk
 * do webpack não muda entre builds, uma rota nova responde 401 igual a uma rota
 * inexistente, e uma página protegida redireciona igual a uma que não existe.
 *
 * O BUILD_ID é gerado pelo Next a cada `next build`, então ele muda a cada
 * deploy e só a cada deploy. Comparar o valor antes e depois responde a
 * pergunta em uma requisição.
 *
 * Não expõe nada sensível: é um identificador opaco de build, sem relação com
 * dados, credenciais ou usuários. Por isso é público — precisa ser respondível
 * sem sessão para servir de verificação externa.
 */
export const dynamic = 'force-dynamic'

// Momento em que o processo subiu. Junto com o buildId, distingue "código novo
// publicado" de "processo reiniciado com o mesmo código" — foi exatamente essa
// diferença que gerou confusão quando um build concluiu sem trocar o que estava
// no ar.
const processoIniciadoEm = new Date().toISOString()

/**
 * Commit que originou este build, lido do `.git` do diretório de deploy.
 *
 * O `buildId` prova que HOUVE um build novo, mas não diz QUAL código entrou —
 * e essa diferença custou tempo: uma resposta da Sara citando "últimos 30 dias"
 * foi lida como dado real quando podia ser o modelo renomeando a janela de 7
 * dias, porque não havia como saber se o commit que adiciona as três janelas
 * já estava no ar. Com o SHA, a pergunta "essa correção subiu?" se responde em
 * uma requisição.
 *
 * Lê `.git/HEAD` e, se for uma ref, o arquivo apontado. É um identificador
 * público de versão — sem relação com dados, credenciais ou usuários.
 */
async function lerCommit(): Promise<string | null> {
  try {
    const raiz = process.cwd()
    const head = (await readFile(path.join(raiz, '.git/HEAD'), 'utf8')).trim()
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5).trim()
      const sha = (await readFile(path.join(raiz, '.git', ref), 'utf8')).trim()
      return sha.slice(0, 7)
    }
    return head.slice(0, 7)
  } catch {
    // Deploy sem `.git` (build copiado, container). Não é motivo para falhar.
    return null
  }
}

export async function GET() {
  let buildId: string | null = null
  try {
    buildId = (await readFile(path.join(process.cwd(), '.next/BUILD_ID'), 'utf8')).trim()
  } catch {
    // Em dev o arquivo pode não existir; não é motivo para falhar.
    buildId = null
  }

  return NextResponse.json({
    buildId,
    commit: await lerCommit(),
    processoIniciadoEm,
    agora: new Date().toISOString(),
    // Contenção de conexão desde que o processo subiu. Responde "o limite de
    // pool resolveu?" com número em vez de impressão — ver lib/prisma.ts.
    banco: estatisticasDeConexao(),
  })
}
