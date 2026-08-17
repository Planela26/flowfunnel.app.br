import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

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
    processoIniciadoEm,
    agora: new Date().toISOString(),
  })
}
