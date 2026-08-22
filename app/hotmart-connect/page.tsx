'use client'

import ThemeToggle from '@/components/ThemeToggle'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, CheckCircle, AlertCircle, ExternalLink, Copy, RefreshCw } from 'lucide-react'
import {
  TutorialLayout, TutorialNav, FormField, InfoBox, CopyField,
} from '@/components/IntegrationTutorial'

const STEPS = [
  { id: 1, title: 'Introdução', short: 'Introdução' },
  { id: 2, title: 'Acessar painel Hotmart', short: 'Painel Hotmart' },
  { id: 3, title: 'Configurar Webhook', short: 'Configurar Webhook' },
  { id: 4, title: 'Inserir Credenciais', short: 'Credenciais' },
  { id: 5, title: 'Conectado!', short: 'Conectado' },
]

export default function HotmartConnect() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [credentials, setCredentials] = useState({
    hotmartId: '',
    email: '',
    webhookToken: '',
  })
  const [copied, setCopied] = useState(false)
  const [diag, setDiag] = useState<any>(null)
  const [diagLoading, setDiagLoading] = useState(false)

  // Descobrir por que uma venda não apareceu exigia olhar o banco de produção
  // e o painel da Hotmart ao mesmo tempo. O diagnóstico responde isso de dentro
  // do app, com o mesmo cálculo que o webhook usa para decidir.
  const rodarDiagnostico = async () => {
    setDiagLoading(true)
    try {
      const r = await fetch('/api/integrations/hotmart/diagnostico')
      setDiag(await r.json())
    } catch {
      setDiag({ veredito: 'Não foi possível rodar o diagnóstico. Verifique sua conexão e tente de novo.' })
    } finally {
      setDiagLoading(false)
    }
  }

  // Busca URL tokenizada do backend (ou cria se não existir)
  useEffect(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    fetch('/api/integrations/hotmart', { method: 'GET' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.webhookUrl) {
          setWebhookUrl(data.webhookUrl)
        } else {
          setWebhookUrl(`${base}/api/webhooks/hotmart`)
        }
      })
      .catch(() => {
        setWebhookUrl(`${base}/api/webhooks/hotmart`)
      })
  }, [])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerateToken = async () => {
    if (!confirm('Tem certeza que deseja regenerar o token do webhook?\n\nA URL antiga deixará de funcionar imediatamente. Você precisará atualizar a configuração no painel da Hotmart.')) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/integrations/regenerate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'HOTMART' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao regenerar')
      setWebhookUrl(data.webhookUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao regenerar token')
    } finally {
      setRegenerating(false)
    }
  }

  const handleConnect = async () => {
    if (!credentials.hotmartId || !credentials.webhookToken) {
      setError('Preencha todos os campos obrigatórios')
      return
    }
    if (credentials.webhookToken.length < 8) {
      setError('O token de segurança deve ter pelo menos 8 caracteres')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/integrations/hotmart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar')
      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar Hotmart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50"><ThemeToggle /></div>
      <TutorialLayout steps={STEPS} currentStep={step} accentColor="border-orange-600">

      {/* Step 1 — Intro */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
              <ShoppingCart className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conectar Hotmart</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Rastreie vendas, checkouts e faturamento em tempo real</p>
            </div>
          </div>

          <InfoBox type="info" title="Como funciona a integração">
            <ul className="space-y-1 mt-1">
              <li>• A Hotmart envia notificações automáticas (webhooks) quando uma venda acontece</li>
              <li>• Você configura a URL do webhook no painel Hotmart apontando para este sistema</li>
              <li>• Cada venda, checkout iniciado ou cancelamento aparece automaticamente no dashboard</li>
            </ul>
          </InfoBox>

          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {[
              { icon: '🛒', label: 'Vendas aprovadas', desc: 'PURCHASE_COMPLETE' },
              { icon: '⏳', label: 'Checkouts iniciados', desc: 'PURCHASE_DELAYED' },
              { icon: '❌', label: 'Cancelamentos', desc: 'PURCHASE_CANCELED' },
              { icon: '💰', label: 'Reembolsos', desc: 'PURCHASE_REFUNDED' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 border dark:border-gray-600 rounded-lg dark:text-gray-200">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <InfoBox type="tip" title="O que você vai precisar" className="mt-6">
            <ul className="space-y-1 mt-1">
              <li>• Acesso ao painel da Hotmart como <strong>Produtor</strong></li>
              <li>• O <strong>código do seu produto</strong> (Hotmart ID)</li>
              <li>• Um <strong>token de segurança</strong> (você cria um)</li>
            </ul>
          </InfoBox>

          <TutorialNav
            onNext={() => setStep(2)}
            nextLabel="Começar configuração"
            accentClass="bg-orange-600 hover:bg-orange-700"
          />
        </div>
      )}

      {/* Step 2 — Access Hotmart panel */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-sm flex items-center justify-center">2</span>
            <h2 className="text-xl font-bold dark:text-white">Acessar o Painel da Hotmart</h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Você vai precisar de algumas informações do seu painel Hotmart.</p>

          <ol className="space-y-4">
            {[
              {
                n: 1,
                title: 'Faça login na Hotmart',
                desc: 'Acesse app-vlc.hotmart.com e entre com sua conta de Produtor.',
                link: { href: 'https://app-vlc.hotmart.com/', label: 'Abrir Hotmart' },
              },
              {
                n: 2,
                title: 'Localize o Hotmart ID do seu produto',
                desc: 'Vá em "Produtos" → clique no produto → copie o ID numérico da URL ou no painel de detalhes.',
                highlight: 'O ID do produto é o número que aparece na URL: hotmart.com/product/NOME/ID',
              },
              {
                n: 3,
                title: 'Anote seu e-mail de produtor',
                desc: 'E-mail com o qual você está cadastrado na Hotmart. Aparece nas configurações da conta.',
              },
              {
                // Este passo mandava INVENTAR o token ("pode ser qualquer senha
                // forte"). É a raiz do 403: a Hotmart gera um Hottok por conta e
                // manda o DELA no cabeçalho. Qualquer valor inventado aqui
                // nunca ia bater, e toda entrega era recusada.
                n: 4,
                title: 'Copie o Hottok da sua conta Hotmart',
                desc: 'O Hottok já existe — a Hotmart gerou um para a sua conta e não é possível escolher o valor. Está em Ferramentas → Webhook (API e Notificações) → aba Autenticação, no botão "Mostrar Hottok".',
                highlight: 'Não invente um valor: se não for o Hottok da sua conta, a Hotmart recebe 403 e nenhuma venda entra',
                link: { href: 'https://app-vlc.hotmart.com/tools/webhook/auth', label: 'Abrir Autenticação (Mostrar Hottok)' },
              },
            ].map((item) => (
              <li key={item.n} className="flex gap-4">
                <span className="w-7 h-7 rounded-full bg-orange-600 text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                  {item.n}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{item.desc}</p>
                  {item.highlight && (
                    <p className="mt-1 text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded px-2 py-1 text-yellow-800 dark:text-yellow-300">
                      📍 {item.highlight}
                    </p>
                  )}
                  {item.link && (
                    <a href={item.link.href} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800">
                      <ExternalLink className="w-3 h-3" /> {item.link.label}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <TutorialNav
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            nextLabel="Tenho as informações →"
            accentClass="bg-orange-600 hover:bg-orange-700"
          />
        </div>
      )}

      {/* Step 3 — Configure Webhook in Hotmart */}
      {step === 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-sm flex items-center justify-center">3</span>
            <h2 className="text-xl font-bold dark:text-white">Configurar o Webhook na Hotmart</h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Configure a Hotmart para enviar eventos de venda para este sistema.</p>

          <div className="space-y-5">
            <InfoBox type="info" title="URL do Webhook — Copie esta URL">
              <div className="mt-2">
                <CopyField label="Cole no campo de URL da Hotmart" value={webhookUrl} />
              </div>
              <button
                onClick={handleRegenerateToken}
                disabled={regenerating || !webhookUrl}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-orange-700 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300 disabled:opacity-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Regenerando...' : 'Regenerar token (invalida URL antiga)'}
              </button>
            </InfoBox>

            {/* Diagnóstico — "configurei e a venda não apareceu" tinha cinco
                causas possíveis e nenhuma delas deixava rastro visível. */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">A venda não apareceu no card?</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Confere a URL, o Hottok, as entregas recebidas e se a ingestão está ativa.
                  </p>
                </div>
                <button
                  onClick={rodarDiagnostico}
                  disabled={diagLoading}
                  className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90 disabled:opacity-50 transition"
                >
                  {diagLoading ? 'Verificando...' : 'Rodar diagnóstico'}
                </button>
              </div>

              {diag && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    {diag.veredito}
                  </p>
                  {diag.conectada && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                      <div>Entregas recebidas: <strong>{diag.entregas?.length ?? 0}</strong></div>
                      <div>Ingestão: <strong>{diag.ingestao?.pausada ? 'PAUSADA' : 'ativa'}</strong></div>
                      <div>Vendas gravadas: <strong>{diag.eventosGravados?.vendas ?? 0}</strong></div>
                      <div>Hottok: <strong>{diag.integracao?.hottokConfigurado ? `${diag.integracao.hottokTamanho} caracteres` : 'não configurado'}</strong></div>
                      <div>
                        Faturamento gravado:{' '}
                        <strong>
                          {(diag.eventosGravados?.faturamentoGravado ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                      <div>Entregas de venda: <strong>{diag.eventosGravados?.entregasDeVenda ?? 0}</strong></div>
                    </div>
                  )}

                  {/* Os três campos de preço como a Hotmart mandou. É o dado
                      que separa "ela não mandou valor" de "nós perdemos o
                      valor" — sem ele o diagnóstico só sabia dizer que estava
                      zerado, não o porquê. */}
                  {diag.precosRecebidos && (
                    <div className="text-[11px] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5">
                      <div className="font-semibold mb-1">
                        Valores na última entrega de venda ({diag.precosRecebidos.evento})
                      </div>
                      <ul className="font-mono space-y-0.5">
                        <li>price: {String(diag.precosRecebidos.price ?? '—')}</li>
                        <li>full_price: {String(diag.precosRecebidos.full_price ?? '—')}</li>
                        <li>original_offer_price: {String(diag.precosRecebidos.original_offer_price ?? '—')}</li>
                      </ul>
                    </div>
                  )}
                  {diag.entregas?.length > 0 && (
                    <details className="text-[11px] text-gray-600 dark:text-gray-400">
                      <summary className="cursor-pointer select-none">Últimas entregas da Hotmart</summary>
                      <ul className="mt-1.5 space-y-1">
                        {diag.entregas.map((e: any, i: number) => (
                          <li key={i} className="font-mono">
                            {new Date(e.quando).toLocaleString('pt-BR')} · {e.status} · {e.evento}
                            {e.ingerido === false && ' · NÃO GRAVADA'}
                            {e.erro && ` · ${e.erro}`}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            <ol className="space-y-4">
              {[
                {
                  n: 1,
                  title: 'Acesse Ferramentas → Webhooks',
                  desc: 'No painel Hotmart, vá em "Ferramentas" no menu lateral e clique em "Webhooks".',
                  link: { href: 'https://app-vlc.hotmart.com/tools/webhooks', label: 'Abrir Webhooks na Hotmart' },
                },
                {
                  n: 2,
                  title: 'Clique em "Adicionar webhook" ou "Novo webhook"',
                  desc: 'Crie um novo webhook para o seu produto.',
                },
                {
                  n: 3,
                  title: 'Cole a URL acima no campo de URL',
                  desc: `Cole: ${webhookUrl}`,
                },
                {
                  // Este passo dizia "insira o mesmo token que você criou".
                  // Não existe token para criar: o Hottok é da CONTA, a Hotmart
                  // já o gerou, e fica numa aba separada. Quem inventava um
                  // valor aqui recebia 403 em toda entrega, porque a Hotmart
                  // manda o dela no cabeçalho X-HOTMART-HOTTOK.
                  n: 4,
                  title: 'Copie o Hottok da sua conta',
                  desc: 'O Hottok NÃO é criado por você — a Hotmart já gerou um para a sua conta. Vá em Ferramentas → Webhook (API e Notificações) → aba Autenticação e clique em "Mostrar Hottok". Copie esse valor: é ele que você cola no próximo passo, aqui no FlowSara.',
                  link: { href: 'https://app-vlc.hotmart.com/tools/webhook/auth', label: 'Abrir Autenticação (Mostrar Hottok)' },
                },
                {
                  n: 5,
                  title: 'Selecione os eventos',
                  desc: 'Marque no mínimo: Compra aprovada (PURCHASE_APPROVED) e Compra completa (PURCHASE_COMPLETE) — são estes que registram uma venda. Compra cancelada, reembolsada e em análise (boleto) completam o funil.',
                },
                {
                  n: 6,
                  title: 'Salve e teste',
                  desc: 'Clique em "Salvar" e depois em "Testar" ou "Enviar teste" para verificar se a URL está recebendo corretamente.',
                },
              ].map((item) => (
                <li key={item.n} className="flex gap-4">
                  <span className="w-7 h-7 rounded-full bg-orange-600 text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                    {item.n}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{item.desc}</p>
                    {item.link && (
                      <a href={item.link.href} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800">
                        <ExternalLink className="w-3 h-3" /> {item.link.label}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <InfoBox type="warning" title="O Hottok é da sua conta — você não escolhe o valor">
              A Hotmart gera <strong>um Hottok por conta</strong> e o envia no cabeçalho <code>X-HOTMART-HOTTOK</code> de
              toda requisição. Ele fica em <strong>Ferramentas → Webhook (API e Notificações) → Autenticação</strong>, no
              botão <strong>Mostrar Hottok</strong> — não no formulário da configuração do webhook.
              Se o valor gravado aqui for diferente do da sua conta, <strong>todas as entregas voltam 403</strong> e nenhuma
              venda entra no dashboard. Cole exatamente como aparece lá, sem espaços.
            </InfoBox>
          </div>

          <TutorialNav
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            nextLabel="Webhook configurado →"
            accentClass="bg-orange-600 hover:bg-orange-700"
          />
        </div>
      )}

      {/* Step 4 — Enter credentials */}
      {step === 4 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-sm flex items-center justify-center">4</span>
            <h2 className="text-xl font-bold dark:text-white">Inserir Credenciais</h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Insira os dados do seu produto e o token de segurança que você criou.</p>

          <div className="space-y-5">
            <FormField
              label="Hotmart ID (Código do Produto)"
              tooltip="ID numérico do seu produto na Hotmart. Encontrado na URL do produto ou em Produtos → Detalhes. Ex: 123456"
              hint="Encontre em: Hotmart → Produtos → clique no produto → veja o número na URL ou no painel de detalhes."
              required
            >
              <input
                type="text"
                value={credentials.hotmartId}
                onChange={(e) => { setCredentials({ ...credentials, hotmartId: e.target.value }); setError('') }}
                placeholder="Ex: 123456"
                autoComplete="off"
                data-lpignore="true"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono"
              />
            </FormField>

            <FormField
              label="E-mail do Produtor"
              tooltip="E-mail cadastrado na sua conta Hotmart de Produtor. Usado para identificar sua conta."
              hint="Opcional — mas ajuda na identificação da conta."
            >
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                placeholder="exemplo@provedor.com"
                autoComplete="off"
                data-lpignore="true"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </FormField>

            <FormField
              label="Token de Segurança (Hottok)"
              tooltip="O Hottok da sua CONTA Hotmart, em Ferramentas → Webhook (API e Notificações) → Autenticação → Mostrar Hottok. Não é um valor que você escolhe: a Hotmart envia o dela em cada requisição, e se não bater, toda entrega volta 403."
              hint="Deve ser idêntico ao que você inseriu no painel Hotmart → Webhooks → Token de segurança."
              required
            >
              <input
                type="password"
                value={credentials.webhookToken}
                onChange={(e) => { setCredentials({ ...credentials, webhookToken: e.target.value }); setError('') }}
                placeholder="Cole aqui seu Hottok"
                autoComplete="new-password"
                data-lpignore="true"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {credentials.webhookToken && credentials.webhookToken.length < 8 && (
                <p className="text-xs text-red-600 mt-1">O token deve ter pelo menos 8 caracteres.</p>
              )}
            </FormField>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <InfoBox type="tip" title="Resumo rápido">
              <ul className="space-y-1 mt-1">
                <li>• <strong>Hotmart ID:</strong> número do produto na URL da Hotmart</li>
                <li>• <strong>E-mail:</strong> e-mail da sua conta de Produtor</li>
                <li>• <strong>Token:</strong> o mesmo que você colocou no webhook da Hotmart</li>
              </ul>
            </InfoBox>
          </div>

          <TutorialNav
            onBack={() => setStep(3)}
            onNext={handleConnect}
            nextLabel="Salvar e conectar"
            nextDisabled={!credentials.hotmartId || !credentials.webhookToken || credentials.webhookToken.length < 8}
            loading={loading}
            accentClass="bg-orange-600 hover:bg-orange-700"
          />
        </div>
      )}

      {/* Step 5 — Success */}
      {step === 5 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8 text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Hotmart Conectada!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Configuração salva com sucesso. A partir de agora, cada venda vai aparecer automaticamente no dashboard.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8 text-left">
            <InfoBox type="success" title="O que já está ativo">
              <ul className="space-y-1 mt-1">
                <li>• Vendas aprovadas aparecem no funil</li>
                <li>• Checkouts iniciados são rastreados</li>
                <li>• Faturamento calculado automaticamente</li>
              </ul>
            </InfoBox>
            <InfoBox type="info" title="URL configurada na Hotmart">
              <p className="text-xs font-mono break-all mt-1 bg-white border rounded px-2 py-1">{webhookUrl}</p>
              <p className="text-xs mt-2 text-gray-600 dark:text-gray-400 dark:text-gray-500">Se precisar reconfigurar, use esta URL no painel Hotmart → Ferramentas → Webhooks.</p>
            </InfoBox>
          </div>

          <InfoBox type="tip" title="Próximo passo: faça uma venda teste">
            Faça uma venda teste (ou use o botão "Testar" na Hotmart) e verifique nos Webhooks do dashboard se o evento apareceu.
            <a href="/webhooks" className="ml-2 text-blue-600 hover:text-blue-800 underline">
              Ver logs de webhooks →
            </a>
          </InfoBox>

          <div className="flex gap-3 justify-center mt-8">
            <button onClick={() => router.push('/dashboard')}
              className="bg-orange-600 text-white py-2.5 px-8 rounded-lg font-semibold hover:bg-orange-700 transition">
              Ir para o Dashboard
            </button>
            <a href="https://app-vlc.hotmart.com/tools/webhooks" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition font-medium">
              <ExternalLink className="w-4 h-4" />
              Abrir Hotmart
            </a>
          </div>
        </div>
      )}

    </TutorialLayout>
    </>
  )
}
