'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'
import {
  TutorialLayout, TutorialNav, FormField, InfoBox, CopyField,
} from '@/components/IntegrationTutorial'

const STEPS = [
  { id: 1, title: 'Introdução', short: 'Introdução' },
  { id: 2, title: 'Acessar painel Eduzz', short: 'Painel Eduzz' },
  { id: 3, title: 'Configurar Webhook', short: 'Webhook' },
  { id: 4, title: 'Inserir Credenciais', short: 'Credenciais' },
  { id: 5, title: 'Conectado!', short: 'Conectado' },
]

export default function EduzzConnect() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [credentials, setCredentials] = useState({ email: '', publicKey: '' })

  useEffect(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    fetch('/api/integrations/eduzz', { method: 'GET' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.webhookUrl) setWebhookUrl(data.webhookUrl)
        else setWebhookUrl(`${base}/api/webhooks/eduzz`)
      })
      .catch(() => setWebhookUrl(`${base}/api/webhooks/eduzz`))
  }, [])

  const handleRegenerateToken = async () => {
    if (!confirm('Tem certeza que deseja regenerar o token do webhook?\n\nA URL antiga deixará de funcionar imediatamente. Você precisará atualizar a configuração no painel da Eduzz.')) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/integrations/regenerate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'EDUZZ' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao regenerar')
      setWebhookUrl(data.webhookUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao regenerar token')
    } finally { setRegenerating(false) }
  }

  const handleConnect = async () => {
    if (!credentials.email || !credentials.publicKey) { setError('Preencha todos os campos'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/integrations/eduzz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar')
      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar Eduzz')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50"><ThemeToggle /></div>
      <TutorialLayout steps={STEPS} currentStep={step} accentColor="border-purple-600">

        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Eduzz</h2>
                <p className="text-gray-500 dark:text-gray-400">Plataforma de vendas de infoprodutos</p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Conecte a Eduzz para rastrear vendas e checkouts automaticamente no seu funil.</p>
            <InfoBox>Você vai configurar um webhook no painel da Eduzz e inserir sua Public Key para autenticação.</InfoBox>
            <TutorialNav onNext={() => setStep(2)} />
          </div>
        )}

        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Acessar o painel da Eduzz</h2>
            <ol className="space-y-3 text-gray-600 dark:text-gray-300 mb-6">
              <li className="flex gap-3"><span className="font-bold text-purple-600 w-5">1.</span>Acesse <a href="https://app.eduzz.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">app.eduzz.com <ExternalLink className="w-3 h-3" /></a></li>
              <li className="flex gap-3"><span className="font-bold text-purple-600 w-5">2.</span>Faça login na sua conta Eduzz.</li>
              <li className="flex gap-3"><span className="font-bold text-purple-600 w-5">3.</span>Vá em <strong>Minha Conta → Credenciais de Acesso</strong> para obter sua Public Key.</li>
            </ol>
            <TutorialNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Configurar Webhook</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Cole esta URL no campo de webhook nos seus produtos Eduzz:</p>
            <CopyField value={webhookUrl} label="URL do Webhook" />
            <button
              onClick={handleRegenerateToken}
              disabled={regenerating || !webhookUrl}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Regenerando...' : 'Regenerar token (invalida URL antiga)'}
            </button>
            <InfoBox className="mt-4">No painel da Eduzz, vá em cada produto → <strong>Notificações → Postback URL</strong> e cole a URL acima.</InfoBox>
            <TutorialNav onBack={() => setStep(2)} onNext={() => setStep(4)} />
          </div>
        )}

        {step === 4 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Inserir Credenciais</h2>
            <div className="space-y-5">
              <FormField label="E-mail da conta Eduzz" required>
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials(c => ({ ...c, email: e.target.value }))}
                  placeholder="exemplo@provedor.com"
                  autoComplete="off"
                  data-lpignore="true"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </FormField>
              <FormField label="Public Key da Eduzz" required>
                <input
                  type="password"
                  value={credentials.publicKey}
                  onChange={(e) => setCredentials(c => ({ ...c, publicKey: e.target.value }))}
                  placeholder="Cole aqui sua Public Key"
                  autoComplete="new-password"
                  data-lpignore="true"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </FormField>
            </div>
            {error && <p className="text-red-600 text-sm mt-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</p>}
            <TutorialNav onBack={() => setStep(3)} onNext={handleConnect} nextLabel={loading ? 'Conectando...' : 'Conectar'} nextDisabled={loading} />
          </div>
        )}

        {step === 5 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Eduzz Conectada!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">As vendas da Eduzz serão rastreadas automaticamente no seu funil.</p>
            <button onClick={() => router.push('/dashboard')} className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-purple-700 transition">Ver Dashboard</button>
          </div>
        )}

      </TutorialLayout>
    </>
  )
}
