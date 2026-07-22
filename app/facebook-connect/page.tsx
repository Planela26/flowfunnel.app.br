'use client'

import ThemeToggle from '@/components/ThemeToggle'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Facebook, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import {
  TutorialLayout, TutorialNav, FormField, InfoBox, CopyField, Tooltip,
} from '@/components/IntegrationTutorial'

const STEPS = [
  { id: 1, title: 'Introdução', short: 'Introdução' },
  { id: 2, title: 'Criar App Meta', short: 'Criar App Meta' },
  { id: 3, title: 'Gerar Access Token', short: 'Access Token' },
  { id: 4, title: 'Inserir Credenciais', short: 'Credenciais' },
  { id: 5, title: 'Selecionar Conta', short: 'Conta de Anúncios' },
  { id: 6, title: 'Conectado!', short: 'Conectado' },
]

export default function FacebookConnect() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [credentials, setCredentials] = useState({ appId: '', appSecret: '' })
  const [adAccounts, setAdAccounts] = useState<any[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')

  const handleValidateToken = async () => {
    if (!accessToken) { setError('Insira o Access Token'); return }
    setLoading(true); setError('')
    try {
      const validateRes = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`)
      const validateData = await validateRes.json()
      if (!validateRes.ok) throw new Error(validateData.error?.message || 'Token inválido')

      const accountsRes = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`
      )
      const accountsData = await accountsRes.json()
      if (!accountsRes.ok) throw new Error(accountsData.error?.message || 'Erro ao buscar contas')
      if (!accountsData.data?.length) throw new Error('Nenhuma conta de anúncios encontrada. Verifique as permissões do token.')

      setAdAccounts(accountsData.data)
      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar token')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!selectedAccount) { setError('Selecione uma conta de anúncios'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/integrations/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          adAccountId: selectedAccount.replace('act_', ''),
          appId: credentials.appId,
          appSecret: credentials.appSecret,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar')
      setStep(6)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar Facebook Ads')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50"><ThemeToggle /></div>
      <TutorialLayout steps={STEPS} currentStep={step} accentColor="border-blue-600">

      {/* Step 1 — Intro */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <Facebook className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conectar Facebook / Meta Ads</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Métricas de campanhas em tempo real no dashboard</p>
            </div>
          </div>

          <InfoBox type="info" title="O que você vai precisar">
            <ul className="space-y-1 mt-1">
              <li>• Conta no <strong>Meta for Developers</strong></li>
              <li>• <strong>Conta de anúncios ativa</strong> no Meta Business Manager</li>
              <li>• Permissões: <code className="bg-white border rounded px-1 text-xs">ads_read</code>, <code className="bg-white border rounded px-1 text-xs">ads_management</code></li>
              <li>• Opcionalmente: App ID e App Secret para tokens de longa duração</li>
            </ul>
          </InfoBox>

          <div className="mt-6 grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🔑', label: 'Gerar Token', desc: 'Pelo Graph API Explorer' },
              { icon: '🧪', label: 'Validar', desc: 'Testamos automaticamente' },
              { icon: '📊', label: 'Escolher conta', desc: 'Selecione a conta de anúncios' },
            ].map((item) => (
              <div key={item.label} className="border rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">{item.icon}</div>
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>

          <TutorialNav
            onNext={() => setStep(2)}
            nextLabel="Começar tutorial"
            accentClass="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      )}

      {/* Step 2 — Create Meta App */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">2</span>
            <h2 className="text-xl font-bold dark:text-white">Criar e configurar o App no Meta</h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Se você já tem um App com acesso à Marketing API, pode pular este passo.</p>

          <ol className="space-y-4">
            {[
              {
                n: 1,
                title: 'Acesse o Meta Developer Console',
                desc: 'Faça login em developers.facebook.com com sua conta Meta/Facebook.',
                link: { href: 'https://developers.facebook.com/apps/', label: 'Abrir Developer Console' },
              },
              {
                n: 2,
                title: 'Crie um App do tipo "Business"',
                desc: 'Clique em "Criar App" → selecione "Business" → preencha o nome e e-mail de contato.',
              },
              {
                n: 3,
                title: 'Adicione o produto "Marketing API"',
                desc: 'Dentro do App, clique em "Adicionar Produto" e selecione "Marketing API". Isso dá acesso às métricas de anúncios.',
              },
              {
                n: 4,
                title: 'Anote o App ID e App Secret',
                desc: 'Vá em "Configurações → Básico". Copie o App ID e App Secret — você vai usar no próximo passo para gerar um token de longa duração.',
                highlight: 'App ID e App Secret estão em: App → Configurações → Básico',
              },
            ].map((item) => (
              <li key={item.n} className="flex gap-4">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
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

          <InfoBox type="tip" title="Atalho" className="mt-4">
            Se você não precisa de um App próprio, pode usar o <strong>Graph API Explorer</strong> para gerar um token de teste rapidamente
            (válido por 1-2 horas para testes iniciais).
            <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer"
              className="ml-2 text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Abrir Graph API Explorer
            </a>
          </InfoBox>

          <TutorialNav
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            nextLabel="Próximo: Gerar token →"
            accentClass="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      )}

      {/* Step 3 — Generate Access Token */}
      {step === 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">3</span>
            <h2 className="text-xl font-bold dark:text-white">Gerar o Access Token</h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Siga uma das opções abaixo para obter o token de acesso.</p>

          <div className="space-y-6">
            {/* Option A */}
            <div className="border-2 border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">RECOMENDADO</span>
                <h3 className="font-bold text-gray-900 dark:text-white">Opção A — Token via System User (Permanente)</h3>
              </div>
              <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">1.</span> Acesse o <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Meta Business Manager → Usuários do sistema</a></li>
                <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">2.</span> Clique em "Adicionar" e crie um usuário do sistema com função "Administrador"</li>
                <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">3.</span> Clique em "Gerar token" → selecione seu App</li>
                <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">4.</span> Marque as permissões: <code className="bg-gray-100 px-1 rounded">ads_read</code>, <code className="bg-gray-100 px-1 rounded">ads_management</code></li>
                <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">5.</span> Defina expiração como "Nunca expira" e clique em "Gerar token"</li>
              </ol>
            </div>

            {/* Option B */}
            <div className="border rounded-xl p-5 bg-gray-50">
              <h3 className="font-bold text-gray-900 mb-3">Opção B — Token pelo Graph API Explorer (Teste)</h3>
              <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="font-bold text-gray-500 shrink-0">1.</span> Abra o <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Graph API Explorer</a></li>
                <li className="flex gap-2"><span className="font-bold text-gray-500 shrink-0">2.</span> Selecione seu App no menu "Meta App"</li>
                <li className="flex gap-2"><span className="font-bold text-gray-500 shrink-0">3.</span> Clique em "Add a Permission" → adicione <code className="bg-white border rounded px-1">ads_read</code> e <code className="bg-white border rounded px-1">ads_management</code></li>
                <li className="flex gap-2"><span className="font-bold text-gray-500 shrink-0">4.</span> Clique em "Generate Access Token" e autorize</li>
                <li className="flex gap-2"><span className="font-bold text-gray-500 shrink-0">5.</span> Copie o token gerado (expira em ~1h)</li>
              </ol>
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-3">
                ⚠️ Token da opção B expira rapidamente. Use apenas para testes. Para produção, use a Opção A.
              </p>
            </div>

            <InfoBox type="info" title="Token de longa duração (60 dias)">
              Se usar a Opção B, converta o token de curta duração em longa duração via Graph API:
              <br />
              <code className="text-xs bg-white border rounded px-2 py-1 block mt-2 break-all">
                GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=TOKEN_CURTA_DURACAO
              </code>
            </InfoBox>
          </div>

          <TutorialNav
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            nextLabel="Tenho o token →"
            accentClass="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      )}

      {/* Step 4 — Enter credentials */}
      {step === 4 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">4</span>
            <h2 className="text-xl font-bold dark:text-white">Inserir Credenciais</h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Cole o token gerado no passo anterior. Vamos validá-lo e listar suas contas de anúncios.</p>

          <div className="space-y-5">
            <FormField
              label="Access Token do Facebook / Meta"
              tooltip="Token de acesso gerado pelo Graph API Explorer ou System Users do Business Manager. Precisa das permissões ads_read e ads_management."
              hint="Começa com EAA... — cole o token completo sem espaços."
              required
            >
              <textarea
                value={accessToken}
                onChange={(e) => { setAccessToken(e.target.value); setError('') }}
                placeholder="EAAxxxxxxxxxx..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </FormField>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                label="App ID"
                tooltip="ID do seu App no Meta Developer Console. Encontrado em: App → Configurações → Básico. Necessário para converter tokens de curta para longa duração."
                hint="Exemplo: 123456789012345"
              >
                <input
                  type="text"
                  value={credentials.appId}
                  onChange={(e) => setCredentials({ ...credentials, appId: e.target.value })}
                  placeholder="123456789012345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField
                label="App Secret"
                tooltip="Chave secreta do seu App. Encontrado em: App → Configurações → Básico. Mantenha em segredo — nunca compartilhe publicamente."
                hint="Para renovação automática de tokens."
              >
                <input
                  type="password"
                  value={credentials.appSecret}
                  onChange={(e) => setCredentials({ ...credentials, appSecret: e.target.value })}
                  placeholder="abc123def456..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <InfoBox type="tip" title="Onde encontrar as credenciais">
              <ul className="space-y-1 mt-1">
                <li>• <strong>Access Token:</strong> Graph API Explorer ou Business Manager → System Users</li>
                <li>• <strong>App ID &amp; Secret:</strong> Developer Console → seu App → Configurações → Básico</li>
              </ul>
            </InfoBox>
          </div>

          <TutorialNav
            onBack={() => setStep(3)}
            onNext={handleValidateToken}
            nextLabel="Validar token e listar contas"
            nextDisabled={!accessToken}
            loading={loading}
            accentClass="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      )}

      {/* Step 5 — Select ad account */}
      {step === 5 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">5</span>
            <h2 className="text-xl font-bold dark:text-white">Selecionar Conta de Anúncios</h2>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 mb-6">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 font-medium">
              Token válido! {adAccounts.length} conta(s) de anúncios encontrada(s).
            </p>
          </div>

          <div className="space-y-3 mb-5">
            {adAccounts.map((account) => (
              <label
                key={account.id}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedAccount === account.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                <input
                  type="radio"
                  name="adAccount"
                  value={account.id}
                  checked={selectedAccount === account.id}
                  onChange={(e) => { setSelectedAccount(e.target.value); setError('') }}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="ml-3 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{account.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    ID: {account.id} &bull; {account.currency} &bull;{' '}
                    {account.account_status === 1 ? '✅ Ativa' : '❌ Inativa'}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <InfoBox type="tip" title="Dica">
            Se você não vê nenhuma conta, verifique que o token tem a permissão <code className="bg-white border rounded px-1 text-xs">ads_read</code> e que sua conta de anúncios está vinculada ao mesmo Business Manager do token.
          </InfoBox>

          <TutorialNav
            onBack={() => setStep(4)}
            onNext={handleConnect}
            nextLabel="Conectar conta de anúncios"
            nextDisabled={!selectedAccount}
            loading={loading}
            accentClass="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      )}

      {/* Step 6 — Success */}
      {step === 6 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Facebook Ads Conectado!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Sua conta de anúncios foi conectada. As métricas já estão disponíveis no dashboard.</p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8 text-left">
            <InfoBox type="success" title="O que está funcionando">
              <ul className="space-y-1 mt-1">
                <li>• CPM, CPC, CTR sincronizados</li>
                <li>• Gastos e impressões em tempo real</li>
                <li>• Dados por campanha disponíveis</li>
              </ul>
            </InfoBox>
            <InfoBox type="tip" title="Próximos passos">
              <ul className="space-y-1 mt-1">
                <li>• Conecte WhatsApp e Hotmart</li>
                <li>• Configure alertas de CPC</li>
                <li>• Explore o Analytics</li>
              </ul>
            </InfoBox>
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/dashboard')}
              className="bg-blue-600 text-white py-2.5 px-8 rounded-lg font-semibold hover:bg-blue-700 transition">
              Ir para o Dashboard
            </button>
            <button onClick={() => router.push('/settings')}
              className="px-8 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition font-medium">
              Configurações
            </button>
          </div>
        </div>
      )}

    </TutorialLayout>
    </>
  )
}
