'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle, Copy, ExternalLink, ArrowLeft, RefreshCw } from 'lucide-react'

export default function KiwifyConnect() {
  const [copied, setCopied] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    fetch('/api/integrations/kiwify', { method: 'GET' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.webhookUrl) setWebhookUrl(data.webhookUrl)
        else setWebhookUrl(`${base}/api/webhooks/kiwify`)
      })
      .catch(() => setWebhookUrl(`${base}/api/webhooks/kiwify`))
  }, [])

  const handleRegenerateToken = async () => {
    if (!confirm('Tem certeza que deseja regenerar o token do webhook?\n\nA URL antiga deixará de funcionar imediatamente. Você precisará atualizar a configuração no painel da Kiwify.')) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/integrations/regenerate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'KIWIFY' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao regenerar')
      setWebhookUrl(data.webhookUrl)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao regenerar token')
    } finally { setRegenerating(false) }
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/settings" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar às Configurações
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-green-700">K</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Conectar Kiwify</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure o webhook para rastrear vendas</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Como funciona?</p>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                A Kiwify envia notificações automáticas (webhooks) quando uma venda é realizada.
                Basta registrar a URL abaixo nas configurações do seu produto na Kiwify.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Passo 1 — URL do Webhook</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Copie esta URL e cole no campo de webhook do seu produto na Kiwify:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-3 py-2 rounded-lg font-mono break-all">
                  {webhookUrl}
                </code>
                <button
                  onClick={copyUrl}
                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition shrink-0"
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <button
                onClick={handleRegenerateToken}
                disabled={regenerating || !webhookUrl}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 disabled:opacity-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Regenerando...' : 'Regenerar token (invalida URL antiga)'}
              </button>
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Passo 2 — Configurar na Kiwify</h2>
              <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                  Acesse o painel da Kiwify e vá em <strong className="text-gray-800 dark:text-gray-200">Produtos → seu produto → Webhooks</strong>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                  Clique em <strong className="text-gray-800 dark:text-gray-200">Adicionar Webhook</strong>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                  Cole a URL acima no campo de URL do webhook
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">4</span>
                  Selecione os eventos: <strong className="text-gray-800 dark:text-gray-200">order.paid, order.refunded, order.chargeback</strong>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">5</span>
                  Salve e registre a integração na tela de Configurações abaixo
                </li>
              </ol>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                ⚠️ <strong>Importante:</strong> Registre também a integração na página de{' '}
                <Link href="/settings" className="underline">Configurações</Link>{' '}
                para que os webhooks sejam associados à sua conta.
              </p>
            </div>

            <a
              href="https://dashboard.kiwify.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir painel da Kiwify
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
