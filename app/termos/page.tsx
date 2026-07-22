import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Termos de Uso — FlowFunnel',
  description: 'Termos de Uso da plataforma FlowFunnel.',
}

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <article className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm max-w-none">
          <div className="space-y-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <header className="space-y-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Termos de Uso</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Última atualização: 03 de maio de 2026</p>
              <p>
                <strong>FlowFunnel é operado por Gabriel de Souza Areal</strong>, pessoa física residente e domiciliada no Brasil, inscrito no CPF sob nº 173.8**.***-**.
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Aceitação dos termos</h2>
              <p>
                Ao criar uma conta ou utilizar a plataforma FlowFunnel (&ldquo;Plataforma&rdquo;), você (&ldquo;Usuário&rdquo;) declara ter lido, compreendido e aceito integralmente estes Termos de Uso e a{' '}
                <Link href="/privacidade" className="text-blue-600 hover:underline">Política de Privacidade</Link>.
                {' '}Caso não concorde com qualquer disposição, não utilize o serviço.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Sobre o serviço</h2>
              <p>
                O FlowFunnel é uma ferramenta SaaS que organiza funis de vendas, métricas, integrações com WhatsApp Business, plataformas de anúncios (Meta, Google, TikTok) e plataformas de checkout (Hotmart, Kiwify, Eduzz, Monetizze, Perfect Pay), oferecendo dashboards, relatórios e análises automatizadas.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. Cadastro e conta</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>O Usuário deve fornecer dados verdadeiros, atualizados e completos.</li>
                <li>É exigida verificação do email cadastrado antes de acessar recursos sensíveis da Plataforma.</li>
                <li>O Usuário é responsável pela confidencialidade da sua senha e por todas as atividades realizadas em sua conta.</li>
                <li>É proibida a criação de contas falsas ou em nome de terceiros.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">4. Proteção de dados e LGPD</h2>
              <p>
                A Plataforma pode coletar e tratar dados como: endereço de email, endereço IP, registros de uso, dados técnicos do dispositivo, integrações conectadas, eventos de navegação e informações necessárias ao funcionamento dos recursos contratados.
              </p>
              <p>
                O tratamento desses dados ocorre para permitir o funcionamento da Plataforma, autenticação, geração de métricas, analytics, melhorias de produto, prevenção a fraudes, suporte técnico e execução do contrato.
              </p>
              <p>
                O Usuário poderá exercer seus direitos previstos na LGPD, incluindo acesso, correção, atualização e exclusão dos dados, nos termos da legislação aplicável e das limitações técnicas e regulatórias cabíveis.
              </p>
              <p>
                A Política de Privacidade da FlowFunnel é documento separado e complementar a estes Termos.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">5. Planos, pagamentos e cancelamento</h2>
              <p>
                A Plataforma é oferecida em planos (Start, Pro, Scale) com recursos e limites distintos descritos em{' '}
                <Link href="/pricing" className="text-blue-600 hover:underline">/pricing</Link>.
                {' '}Os pagamentos são processados via Stripe e, quando aplicável, podem ocorrer em regime de renovação automática até cancelamento pelo Usuário.
              </p>
              <p>
                O cancelamento pode ser feito a qualquer momento; o acesso permanece ativo até o fim do ciclo já pago. Em caso de falha de pagamento, o acesso poderá ser suspenso ou limitado até a regularização.
              </p>
              <p>
                Não há reembolso proporcional por períodos não utilizados, exceto nas hipóteses de determinação legal expressa, incluindo o direito de arrependimento quando aplicável.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">6. WhatsApp Business e integrações oficiais</h2>
              <p>
                Quando o plano contratado exigir conexão oficial com a API da Meta (WhatsApp Cloud API), <strong>é obrigatório possuir conta verificada do WhatsApp Business</strong>. Sem essa verificação, recursos como envio de mensagens, webhooks oficiais e métricas avançadas podem não ser liberados.
              </p>
              <p>
                O FlowFunnel não se responsabiliza por bloqueios, suspensões ou penalidades aplicadas pela Meta, Google, TikTok ou qualquer plataforma de terceiros à conta do Usuário em razão de violação dos termos dessas plataformas.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">7. Uso permitido e proibido</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>É proibido usar a Plataforma para envio de spam, golpes, phishing ou conteúdo ilícito.</li>
                <li>É proibido revender, sublicenciar ou usar engenharia reversa no software.</li>
                <li>É proibido tentar acessar dados de outros usuários ou explorar vulnerabilidades.</li>
                <li>É proibido utilizar a Plataforma em desconformidade com os termos de terceiros, incluindo Meta, Google, TikTok, Hotmart, Kiwify, Eduzz, Monetizze e Perfect Pay.</li>
                <li>O FlowFunnel pode suspender ou encerrar contas que violem estas regras.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">8. Propriedade intelectual</h2>
              <p>
                Todo o software, marca, layout e conteúdo do FlowFunnel são de propriedade exclusiva da empresa. Os dados inseridos pelo Usuário (funis, leads, métricas) permanecem de sua propriedade; o FlowFunnel apenas processa esses dados para operar o serviço.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">9. Limitação de responsabilidade</h2>
              <p>
                O serviço é fornecido &ldquo;como está&rdquo;. O FlowFunnel não garante operação ininterrupta, livre de erros ou que atenda a objetivos comerciais específicos. Não garantimos resultados financeiros, performance comercial ou conversão de vendas.
              </p>
              <p>
                Não nos responsabilizamos por perdas indiretas, lucros cessantes, decisões comerciais tomadas com base nas métricas exibidas ou quaisquer efeitos decorrentes do uso da Plataforma. A responsabilidade total do FlowFunnel fica limitada ao valor efetivamente pago pelo Usuário nos últimos 12 meses.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">10. Suspensão e exclusão da conta</h2>
              <p>
                O Usuário pode excluir sua conta a qualquer momento em{' '}
                <Link href="/account" className="text-blue-600 hover:underline">/account</Link>.
                {' '}O FlowFunnel pode suspender ou excluir contas que violem estes termos, mediante aviso prévio quando possível.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">11. Alterações dos termos</h2>
              <p>
                Estes termos podem ser atualizados a qualquer momento. Mudanças relevantes serão comunicadas pelo email cadastrado ou aviso na Plataforma. O uso continuado após a notificação implica aceitação das novas condições.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">12. Lei aplicável e foro</h2>
              <p>
                Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial pelo Código de Defesa do Consumidor (Lei 8.078/1990) e pela Lei Geral de Proteção de Dados (Lei 13.709/2018). Fica eleito o foro da comarca do domicílio do Usuário consumidor para dirimir dúvidas oriundas destes Termos.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">13. Contato</h2>
              <p>
                Dúvidas sobre estes Termos podem ser enviadas para{' '}
                <a href="mailto:contato@flowfunnel.app.br" className="text-blue-600 hover:underline">contato@flowfunnel.app.br</a>.
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}
