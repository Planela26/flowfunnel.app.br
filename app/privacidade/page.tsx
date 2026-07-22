import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Política de Privacidade — FlowFunnel',
  description:
    'Política de Privacidade e proteção de dados (LGPD) da plataforma FlowFunnel.',
}

export default function PrivacidadePage() {
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Política de Privacidade
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Última atualização: 03 de maio de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">1. Quem somos</h2>
              <p>
                O FlowFunnel (&ldquo;nós&rdquo;) é uma plataforma SaaS de gestão de funis de vendas e integrações com WhatsApp Business, plataformas de anúncios e checkouts. Esta política descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">2. Dados que coletamos</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Cadastrais:</strong> nome, email, senha (criptografada com bcrypt), plano contratado.</li>
                <li><strong>Pagamento:</strong> processado integralmente pela Stripe. Não armazenamos dados de cartão; recebemos apenas identificadores do cliente e da assinatura.</li>
                <li><strong>Integrações:</strong> tokens de acesso e identificadores das contas que você conectar (WhatsApp, Meta Ads, Google, TikTok, Hotmart, Kiwify, Eduzz, Monetizze, Perfect Pay).</li>
                <li><strong>Operacionais:</strong> métricas, eventos de webhook, leads, conversões e logs gerados pelo uso da Plataforma.</li>
                <li><strong>Técnicos:</strong> endereço IP, navegador, sistema operacional, cookies e logs de acesso para segurança.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">3. Bases legais (LGPD)</h2>
              <p>
                Tratamos dados com base em: (i) execução do contrato (operar o serviço contratado), (ii) consentimento (cookies opcionais e comunicações de marketing), (iii) legítimo interesse (segurança, prevenção de fraude e melhoria do produto) e (iv) cumprimento de obrigação legal (registros fiscais e atendimento a autoridades).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">4. Como usamos seus dados</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Operar funcionalidades, integrações e dashboards.</li>
                <li>Autenticar acesso, prevenir fraudes e proteger sua conta.</li>
                <li>Enviar emails transacionais (verificação, redefinição, alertas).</li>
                <li>Gerar análises agregadas e sugestões automatizadas com IA.</li>
                <li>Cumprir obrigações legais e responder a autoridades.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">5. Compartilhamento de dados</h2>
              <p>
                Compartilhamos dados estritamente necessários com operadores que viabilizam o serviço:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Stripe</strong> — processamento de pagamentos</li>
                <li><strong>Resend</strong> — envio de emails transacionais</li>
                <li><strong>OpenAI</strong> — geração de sugestões e análises (quando habilitado)</li>
                <li><strong>Meta, Google, TikTok</strong> — integrações de anúncios autorizadas pelo Usuário</li>
                <li><strong>Hotmart, Kiwify, Eduzz, Monetizze, Perfect Pay</strong> — integrações de checkout autorizadas pelo Usuário</li>
                <li><strong>Provedor de hospedagem em nuvem</strong> — armazenamento e processamento</li>
              </ul>
              <p>
                Não vendemos seus dados pessoais a terceiros sob nenhuma hipótese.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">6. Cookies</h2>
              <p>
                Utilizamos cookies essenciais (login e sessão) e, mediante consentimento, cookies de análise e marketing. Você pode revisar suas preferências a qualquer momento limpando o armazenamento do navegador para reabrir o banner de consentimento.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">7. Segurança</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Senhas armazenadas com hash bcrypt (custo 12).</li>
                <li>Comunicação criptografada via HTTPS/TLS.</li>
                <li>Tokens de acesso de integrações armazenados de forma protegida.</li>
                <li>Controles de rate limiting, validação de webhooks e auditoria de acessos.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">8. Retenção</h2>
              <p>
                Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão, dados pessoais são removidos em até 30 dias, salvo obrigação legal de retenção (ex.: registros fiscais por até 5 anos).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">9. Seus direitos (LGPD, art. 18)</h2>
              <p>Você pode, a qualquer momento:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Confirmar a existência e acessar seus dados</li>
                <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
                <li>Solicitar anonimização, bloqueio ou eliminação</li>
                <li>Solicitar portabilidade dos dados</li>
                <li>Eliminar dados tratados com consentimento — incluindo excluir sua conta diretamente em <Link href="/account" className="text-blue-600 hover:underline">/account</Link></li>
                <li>Revogar consentimento a qualquer momento</li>
                <li>Obter informação sobre compartilhamentos realizados</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">10. Encarregado de Dados (DPO)</h2>
              <p>
                Para exercer seus direitos ou tirar dúvidas sobre o tratamento dos seus dados, entre em contato com nosso Encarregado em <a href="mailto:dpo@flowfunnel.app.br" className="text-blue-600 hover:underline">dpo@flowfunnel.app.br</a>. Responderemos em até 15 dias úteis.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">11. Transferência internacional</h2>
              <p>
                Alguns operadores (Stripe, OpenAI, Resend, provedores de hosting, plataformas de anúncios) processam dados fora do Brasil. Nesses casos, adotamos cláusulas contratuais e seguimos os requisitos do Capítulo V da LGPD.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">12. Alterações desta política</h2>
              <p>
                Podemos atualizar esta política periodicamente. Mudanças relevantes serão comunicadas pelo email cadastrado e/ou aviso na Plataforma.
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}
