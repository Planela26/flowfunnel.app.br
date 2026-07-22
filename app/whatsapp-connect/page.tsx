'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  MessageCircle, CheckCircle, AlertCircle, ExternalLink,
  Shield, ArrowLeft, Smartphone, Crown, Loader2,
} from 'lucide-react'
import {
  TutorialLayout, TutorialNav, InfoBox, CopyField,
} from '@/components/IntegrationTutorial'
import Link from 'next/link'
import { usePlan } from '@/components/usePlan'

/* ─── Business API steps (Scale) ─────────────────────────────────────── */
const BUSINESS_STEPS = [
  { id: 1, title: 'Introdução',              short: 'Introdução' },
  { id: 2, title: 'Criar App no Meta',       short: 'Criar App Meta' },
  { id: 3, title: 'Produto WhatsApp',        short: 'Produto WhatsApp' },
  { id: 4, title: 'Configurar Webhook',      short: 'Configurar Webhook' },
  { id: 5, title: 'Inserir Credenciais',     short: 'Credenciais' },
  { id: 6, title: 'Conectado!',              short: 'Conectado' },
]

/* ─── Simple connect via QR Code real (Start / Pro) ──────────────────── */
type QrStatus = 'idle' | 'connecting' | 'qr' | 'connected' | 'error'

function SimpleConnect() {
  const router = useRouter()
  const { info: planInfo } = usePlan()
  const isProOrScale = planInfo.plan === 'PRO' || planInfo.plan === 'SCALE'

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-50"><ThemeToggle /></div>
      <div className="w-full max-w-sm">

        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-[28px] shadow-[0_25px_80px_rgba(0,0,0,0.22)] border border-white/60 dark:border-gray-700 overflow-hidden">
          <div className="relative px-6 pt-7 pb-5 text-center bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_55%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold tracking-wide uppercase mb-4">
                <Shield className="w-3.5 h-3.5" />
                {isProOrScale ? 'Pro / Scale' : 'Start'}
              </div>
              <h2 className="text-3xl font-black leading-tight">
                {isProOrScale ? 'Conexão oficial do WhatsApp Business' : 'Veja seu fluxo de leads'}
              </h2>
              <p className="text-sm text-white/90 mt-2">
                {isProOrScale
                  ? 'Pro e Scale conectam a API oficial da Meta com conta verificada.'
                  : 'Aqui você acompanha o funil. O WhatsApp real fica no Pro e no Scale.'}
              </p>
            </div>
          </div>

          <div className="p-5">
            {isProOrScale ? (
              <div className="mb-4 rounded-2xl bg-gray-900 text-white p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-semibold">Como funciona</p>
                <div className="mt-3 grid gap-2">
                {[
                  'API oficial da Meta',
                  'Número verificado e webhooks',
                  'Mais métricas e insights avançados',
                ].map((item, idx) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2">
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                      <span className="text-sm text-white/90">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl bg-gray-900 text-white p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-semibold">Como funciona</p>
                <div className="mt-3 grid gap-2">
                {[
                    'Fonte de tráfego gera o lead',
                    'Lead entra na etapa WhatsApp',
                    'Checkout captura a venda',
                  ].map((item, idx) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                      <span className="text-sm text-white/90">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                isProOrScale
                  ? { icon: '⚡', title: 'Oficial', desc: 'API da Meta' }
                  : { icon: '⚡', title: 'Rápido', desc: 'Sem setup técnico' },
                isProOrScale
                  ? { icon: '👀', title: 'Profundo', desc: 'Mais métricas' }
                  : { icon: '👀', title: 'Visual', desc: 'Fluxo em tempo real' },
                isProOrScale
                  ? { icon: '🚀', title: 'IA', desc: 'Insights avançados' }
                  : { icon: '🚀', title: 'Leads', desc: 'Acompanhe a jornada' },
                isProOrScale
                  ? { icon: '✨', title: 'Premium', desc: 'Pro / Scale' }
                  : { icon: '✨', title: 'Simples', desc: 'Para Start / Pro' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-3">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-lg mb-2">
                    {item.icon}
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 mb-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {isProOrScale ? 'Conexão oficial liberada' : 'Conecte seu funil, não o celular'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {isProOrScale
                  ? 'Pro e Scale ativam a integração oficial e liberam métricas mais profundas.'
                  : 'Start usa essa tela para visualizar o fluxo. A conexão oficial fica no Pro e no Scale.'}
              </p>
            </div>

            <div className="flex gap-3">
              {isProOrScale ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 py-3.5 bg-gray-900 hover:bg-black text-white font-semibold rounded-2xl transition text-sm"
                >
                  Ver meu fluxo
                </button>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 py-3.5 bg-gray-900 hover:bg-black text-white font-semibold rounded-2xl transition text-sm"
                  >
                    Ver meu fluxo
                  </button>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="flex-1 py-3.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm"
                  >
                    PRO
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 text-center">
              <Link href="/whatsapp-numbers" className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Voltar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Business API connect (Scale) ───────────────────────────────────── */
function BusinessConnect({ plan }: { plan: 'PRO' | 'SCALE' }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const planLabel = plan === 'SCALE' ? 'SCALE' : 'PRO'
  const planBadgeClass = plan === 'SCALE' ? 'bg-purple-600' : 'bg-blue-600'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [webhookBase, setWebhookBase] = useState('')
  const [credentials, setCredentials] = useState({
    accessToken: '', phoneNumberId: '', businessAccountId: '', nickname: '',
  })
  const [validating, setValidating] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') setWebhookBase(window.location.origin)
  }, [])

  const webhookUrl = `${webhookBase}/api/webhooks/whatsapp`

  const validateToken = async () => {
    if (!credentials.accessToken || !credentials.phoneNumberId) return
    setValidating(true)
    setError('')
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}?access_token=${credentials.accessToken}`
      )
      const data = await res.json()
      if (res.ok && data.id) {
        setTokenValid(true)
      } else {
        setError(data.error?.message || 'Token ou Phone Number ID inválido')
        setTokenValid(false)
      }
    } catch {
      setError('Erro ao validar credenciais.')
      setTokenValid(false)
    } finally {
      setValidating(false)
    }
  }

  const handleConnect = async () => {
    if (!credentials.accessToken || !credentials.phoneNumberId || !credentials.businessAccountId) {
      setError('Preencha todos os campos obrigatórios')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/integrations/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...credentials,
          webhookUrl,
          connectionType: 'BUSINESS_API',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar')
      setStep(6)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50"><ThemeToggle /></div>
      <TutorialLayout steps={BUSINESS_STEPS} currentStep={step} accentColor="border-green-600">

        {/* Step 1 */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApp Business API</h1>
                  <span className={`px-2 py-0.5 ${planBadgeClass} text-white text-xs font-bold rounded-full flex items-center gap-1`}>
                    <Crown className="w-3 h-3" /> {planLabel}
                  </span>
                </div>
                <p className="text-gray-500 text-sm">Integração via WhatsApp Cloud API (Meta) — conta verificada</p>
              </div>
            </div>

            <InfoBox type="info" title="O que você vai precisar">
              <ul className="space-y-1 mt-1">
                <li>• Conta no <strong>Meta for Developers</strong></li>
                <li>• Número com <strong>WhatsApp Business</strong> verificado</li>
                <li>• <strong>Conta WABA</strong> aprovada pelo Meta</li>
                <li>• Acesso de admin ao <strong>Meta Business Manager</strong></li>
              </ul>
            </InfoBox>

            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              {[
                { icon: '🏗️', label: 'Criar App', desc: 'No Meta Developer Console' },
                { icon: '📱', label: 'Vincular Número', desc: 'Conectar número verificado' },
                { icon: '🔗', label: 'Configurar Webhook', desc: 'Receber dados em tempo real' },
              ].map((item) => (
                <div key={item.label} className="border dark:border-gray-700 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                <ExternalLink className="w-4 h-4" /> Abrir Meta Developer Console
              </a>
            </div>

            <TutorialNav onNext={() => setStep(2)} nextLabel="Começar tutorial" accentClass="bg-green-600 hover:bg-green-700" />
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center">2</span>
              <h2 className="text-xl font-bold dark:text-white">Criar App no Meta Developer Console</h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Crie um App do tipo <strong>Business</strong> para acessar a WhatsApp Cloud API.</p>
            <ol className="space-y-4">
              {[
                { n: 1, title: 'Acesse o Meta Developer Console', desc: 'Vá em developers.facebook.com e faça login.', link: { href: 'https://developers.facebook.com/apps/', label: 'Abrir Developer Console' } },
                { n: 2, title: 'Clique em "Criar App"', desc: 'No canto superior direito, clique em "Criar App".' },
                { n: 3, title: 'Selecione o tipo "Business"', desc: 'Escolha "Business" para ter acesso à WhatsApp Cloud API.' },
                { n: 4, title: 'Preencha o nome do App', desc: 'Use um nome como "FlowFunnel WhatsApp" e insira seu e-mail.' },
                { n: 5, title: 'Associe ao Business Manager', desc: 'Vincule ao seu portfólio de negócios no Meta Business Manager.' },
              ].map((item) => (
                <li key={item.n} className="flex gap-4">
                  <span className="w-7 h-7 rounded-full bg-green-600 text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">{item.n}</span>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{item.title}</p>
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
            <TutorialNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Já criei o App →" accentClass="bg-green-600 hover:bg-green-700" />
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center">3</span>
              <h2 className="text-xl font-bold dark:text-white">Configurar o Produto WhatsApp</h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Adicione o WhatsApp ao seu App e obtenha as credenciais.</p>
            <ol className="space-y-4">
              {[
                { n: 1, title: 'Adicionar produto WhatsApp', desc: 'No painel do App, clique "Adicionar Produto" → selecione "WhatsApp".' },
                { n: 2, title: 'Conectar conta WABA', desc: 'Em WhatsApp → Configuração, vincule uma conta WhatsApp Business.' },
                { n: 3, title: 'Adicionar número de telefone', desc: 'Em "Números de telefone", adicione e verifique o número.' },
                { n: 4, title: 'Anotar Phone Number ID', desc: 'Na lista de números, copie o "Phone Number ID".', highlight: 'Phone Number ID: coluna ID na tabela de números' },
                { n: 5, title: 'Anotar WABA ID', desc: 'Em "Configuração da conta" copie o WhatsApp Business Account ID.', highlight: 'WABA ID: em Configuração → Conta do WhatsApp Business' },
                { n: 6, title: 'Gerar Access Token permanente', desc: 'Em Business Manager → System Users, gere um token permanente.', link: { href: 'https://business.facebook.com/settings/system-users', label: 'Business Manager → System Users' } },
              ].map((item: any) => (
                <li key={item.n} className="flex gap-4">
                  <span className="w-7 h-7 rounded-full bg-green-600 text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">{item.n}</span>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{item.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{item.desc}</p>
                    {item.highlight && <p className="mt-1 text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded px-2 py-1 text-yellow-800 dark:text-yellow-400">📍 {item.highlight}</p>}
                    {item.link && <a href={item.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800"><ExternalLink className="w-3 h-3" /> {item.link.label}</a>}
                  </div>
                </li>
              ))}
            </ol>
            <TutorialNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Tenho as credenciais →" accentClass="bg-green-600 hover:bg-green-700" />
          </div>
        )}

        {/* Step 4 — Webhook */}
        {step === 4 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center">4</span>
              <h2 className="text-xl font-bold dark:text-white">Configurar o Webhook</h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Configure o webhook no painel Meta para receber dados em tempo real.</p>
            <InfoBox type="info" title="URLs do Webhook">
              <CopyField label="URL do Callback" value={webhookUrl} />
              <p className="text-xs text-gray-500 mt-2">Verify Token: use o valor de WHATSAPP_VERIFY_TOKEN nos seus Secrets do Replit</p>
            </InfoBox>
            <ol className="space-y-4 mt-4">
              {[
                { n: 1, title: 'Abra o App no Meta', desc: 'App → WhatsApp → Configuração.', link: { href: 'https://developers.facebook.com/apps/', label: 'Abrir Developer Console' } },
                { n: 2, title: 'Editar Webhook', desc: 'Na seção Webhook, clique em Configurar.' },
                { n: 3, title: 'Inserir URL do Callback', desc: 'Cole a URL acima.' },
                { n: 4, title: 'Inserir Verify Token', desc: 'Cole o valor WHATSAPP_VERIFY_TOKEN dos seus Secrets.' },
                { n: 5, title: 'Verificar e Salvar', desc: 'Clique em Verificar e Salvar.' },
                { n: 6, title: 'Ativar campos', desc: 'Marque "messages" e "message_deliveries" → clique Assinar.' },
              ].map((item: any) => (
                <li key={item.n} className="flex gap-4">
                  <span className="w-7 h-7 rounded-full bg-green-600 text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">{item.n}</span>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{item.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{item.desc}</p>
                    {item.link && <a href={item.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800"><ExternalLink className="w-3 h-3" /> {item.link.label}</a>}
                  </div>
                </li>
              ))}
            </ol>
            <TutorialNav onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Webhook configurado →" accentClass="bg-green-600 hover:bg-green-700" />
          </div>
        )}

        {/* Step 5 — Credentials */}
        {step === 5 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center">5</span>
              <h2 className="text-xl font-bold dark:text-white">Inserir Credenciais</h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Cole as credenciais copiadas no passo 3.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Apelido do número</label>
                <input type="text" value={credentials.nickname} onChange={e => setCredentials({ ...credentials, nickname: e.target.value })}
                  placeholder="Ex: Vendas Principal"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Access Token <span className="text-red-500">*</span></label>
                <textarea value={credentials.accessToken} onChange={e => { setCredentials({ ...credentials, accessToken: e.target.value }); setTokenValid(false) }}
                  placeholder="EAAxxxxxxxxxx..." rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone Number ID <span className="text-red-500">*</span></label>
                <input type="text" value={credentials.phoneNumberId} onChange={e => { setCredentials({ ...credentials, phoneNumberId: e.target.value }); setTokenValid(false) }}
                  placeholder="123456789012345"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">WABA ID (Business Account ID) <span className="text-red-500">*</span></label>
                <input type="text" value={credentials.businessAccountId} onChange={e => setCredentials({ ...credentials, businessAccountId: e.target.value })}
                  placeholder="987654321098765"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 focus:outline-none" />
              </div>

              <div className="flex items-center gap-3">
                <button onClick={validateToken} disabled={validating || !credentials.accessToken || !credentials.phoneNumberId}
                  className="px-4 py-2 border-2 border-green-600 text-green-700 dark:text-green-400 rounded-lg font-medium text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition disabled:opacity-40">
                  {validating ? 'Validando...' : '🔍 Validar Token'}
                </button>
                {tokenValid && <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Token válido!</span>}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(4)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm">← Voltar</button>
              <button onClick={handleConnect} disabled={loading || !credentials.accessToken || !credentials.phoneNumberId || !credentials.businessAccountId}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg transition text-sm flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</> : 'Conectar WhatsApp'}
              </button>
            </div>
          </div>
        )}

        {/* Step 6 — Success */}
        {step === 6 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">WhatsApp Business conectado!</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Sua conta verificada já está integrada ao FlowFunnel. Leads e conversas aparecerão no dashboard em tempo real.
            </p>
            <div className="space-y-3">
              <button onClick={() => router.push('/dashboard')} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition text-sm">
                Ir para o Dashboard
              </button>
              <button onClick={() => router.push('/whatsapp-numbers')} className="w-full py-3 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm">
                Ver meus números
              </button>
            </div>
          </div>
        )}
      </TutorialLayout>
    </>
  )
}

/* ─── Main page — detect plan and route ───────────────────────────────── */
export default function WhatsAppConnect() {
  const { data: session, status } = useSession()
  const [plan, setPlan] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/plan')
        .then(r => r.json())
        .then(d => setPlan(d.plan || 'START'))
        .catch(() => setPlan('START'))
    }
  }, [status])

  if (status === 'loading' || plan === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (plan === 'PRO' || plan === 'SCALE') return <BusinessConnect plan={plan as 'PRO' | 'SCALE'} />
  return <SimpleConnect />
}
