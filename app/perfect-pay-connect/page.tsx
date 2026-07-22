'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, Copy, RefreshCw } from 'lucide-react'
import {
  TutorialLayout, TutorialNav, FormField, InfoBox, CopyField,
} from '@/components/IntegrationTutorial'

const STEPS = [
  { id: 1, title: 'Introdução', short: 'Introdução' },
  { id: 2, title: 'Acessar painel Perfect Pay', short: 'Painel' },
  { id: 3, title: 'Configurar Webhook', short: 'Webhook' },
  { id: 4, title: 'Inserir Credenciais', short: 'Credenciais' },
  { id: 5, title: 'Conectado!', short: 'Conectado' },
]

export default function PerfectPayConnect() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [credentials, setCredentials] = useState({ apiKey: '', webhookToken: '' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    fetch('/api/integrations/perfect-pay', { method: 'GET' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.webhookUrl) setWebhookUrl(data.webhookUrl)
        else setWebhookUrl(`${base}/api/webhooks/perfect-pay`)
      })
      .catch(() => setWebhookUrl(`${base}/api/webhooks/perfect-pay`))
  }, [])

  const handleRegenerateToken = async () => {
    if (!confirm('Tem certeza que deseja regenerar o token do webhook?\n\nA URL antiga deixará de funcionar imediatamente. Você precisará atualizar a configuração no painel da Perfect Pay.')) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/integrations/regenerate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'PERFECT_PAY' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao regenerar')
      setWebhookUrl(data.webhookUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao regenerar token')
    } finally { setRegenerating(false) }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnect = async () => {
    if (!credentials.apiKey) { setError('Preencha a API Key'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/integrations/perfect-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao conectar')
      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar Perfect Pay')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50"><ThemeToggle /></div>
      <TutorialLayout steps={STEPS} currentStep={step} accentColor="border-blue-700">

        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-700 rounded-xl flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Perfect Pay</h2>
                <p className="text-gray-500 dark:text-gray-400">Integração de vendas e checkout</p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Conecte o Perfect Pay para rastrear vendas, checkouts e dados de compradores automaticamente no seu funil.
            </p>
            <InfoBox>
              Você vai configurar um webhook no painel da Perfect Pay que enviará eventos em tempo real para o FlowFunnel Funnel.
            </InfoBox>
            <TutorialNav onNext={() => setStep(2)} />
          </div>
        )}

        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Acessar o painel da Perfect Pay</h2>
            <ol className="space-y-3 text-gray-600 dark:text-gray-300 mb-6">
              <li className="flex gap-3"><span className="font-bold text-blue-700 w-5">1.</span>Acesse <a href="https://app.perfectpay.com.br" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">app.perfectpay.com.br <ExternalLink className="w-3 h-3" /></a></li>
              <li className="flex gap-3"><span className="font-bold text-blue-700 w-5">2.</span>Faça login com sua conta de vendedor.</li>
              <li className="flex gap-3"><span className="font-bold text-blue-700 w-5">3.</span>Vá em <strong>Configurações → Integrações → Webhook</strong>.</li>
            </ol>
            <TutorialNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Configurar Webhook</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Cole esta URL no campo de webhook do painel da Perfect Pay:</p>
            <CopyField value={webhookUrl} label="URL do Webhook" />
            <button
              onClick={handleRegenerateToken}
              disabled={regenerating || !webhookUrl}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Regenerando...' : 'Regenerar token (invalida URL antiga)'}
            </button>
            <InfoBox className="mt-4">
              Selecione os eventos: <strong>Venda aprovada</strong>, <strong>Venda cancelada</strong> e <strong>Reembolso</strong>.
            </InfoBox>
            <TutorialNav onBack={() => setStep(2)} onNext={() => setStep(4)} />
          </div>
        )}

        {step === 4 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Inserir Credenciais</h2>
            <div className="space-y-5">
              <FormField label="API Key da Perfect Pay" required>
                <input
                  type="password"
                  value={credentials.apiKey}
                  onChange={(e) => setCredentials(c => ({ ...c, apiKey: e.target.value }))}
                  placeholder="Cole aqui sua API Key"
                  autoComplete="new-password"
                  data-lpignore="true"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                />
              </FormField>
              <FormField label="Token de Webhook (opcional)">
                <input
                  type="text"
                  value={credentials.webhookToken}
                  onChange={(e) => setCredentials(c => ({ ...c, webhookToken: e.target.value }))}
                  placeholder="Token de segurança do webhook"
                  autoComplete="off"
                  data-lpignore="true"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Perfect Pay Conectada!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">As vendas serão rastreadas automaticamente no seu funil.</p>
            <button onClick={() => router.push('/dashboard')} className="bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition">
              Ver Dashboard
            </button>
          </div>
        )}

      </TutorialLayout>
    </>
  )
}
