'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface TestResult {
  name: string
  status: 'success' | 'error'
  message: string
  duration: number
}

interface TestResponse {
  success: boolean
  tests: TestResult[]
  message: string
}

export default function TestIntegrationsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'facebook' | 'hotmart'>('whatsapp')
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TestResponse | null>(null)

  // WhatsApp
  const [whatsappData, setWhatsappData] = useState({
    phoneNumberId: '',
    accessToken: '',
  })

  // Facebook
  const [facebookData, setFacebookData] = useState({
    accessToken: '',
    adAccountId: '',
  })

  // Hotmart
  const [hotmartData, setHotmartData] = useState({
    webhookUrl: '',
    webhookToken: '',
  })

  const runTest = async () => {
    setTesting(true)
    setResults(null)

    try {
      let endpoint = ''
      let body = {}

      if (activeTab === 'whatsapp') {
        endpoint = '/api/test-integration/whatsapp'
        body = whatsappData
      } else if (activeTab === 'facebook') {
        endpoint = '/api/test-integration/facebook'
        body = facebookData
      } else if (activeTab === 'hotmart') {
        endpoint = '/api/test-integration/hotmart'
        body = hotmartData
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Erro ao executar testes:', error)
      setResults({
        success: false,
        tests: [{
          name: 'Erro de Conexão',
          status: 'error',
          message: 'Não foi possível conectar ao servidor',
          duration: 0,
        }],
        message: '❌ Erro ao executar testes',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/settings')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ← Voltar
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🧪 Testar Integrações</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <Link
                href="/webhooks"
                className="px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                🔔 Webhooks
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Descrição */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>💡 Dica:</strong> Use esta página para validar suas credenciais antes de salvar nas configurações.
            Os testes verificam se as chaves de API estão corretas e se você tem as permissões necessárias.
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="border-b dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab('whatsapp')
                  setResults(null)
                }}
                className={`px-6 py-4 font-medium transition ${
                  activeTab === 'whatsapp'
                    ? 'border-b-2 border-green-600 text-green-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💬 WhatsApp
              </button>
              <button
                onClick={() => {
                  setActiveTab('facebook')
                  setResults(null)
                }}
                className={`px-6 py-4 font-medium transition ${
                  activeTab === 'facebook'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📘 Facebook Ads
              </button>
              <button
                onClick={() => {
                  setActiveTab('hotmart')
                  setResults(null)
                }}
                className={`px-6 py-4 font-medium transition ${
                  activeTab === 'hotmart'
                    ? 'border-b-2 border-orange-600 text-orange-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🛒 Hotmart
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* WhatsApp Form */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={whatsappData.phoneNumberId}
                    onChange={(e) => setWhatsappData({ ...whatsappData, phoneNumberId: e.target.value })}
                    placeholder="1234567890123456"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Encontre em Meta Business → WhatsApp → Configurações
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={whatsappData.accessToken}
                    onChange={(e) => setWhatsappData({ ...whatsappData, accessToken: e.target.value })}
                    placeholder="EAAxxxxxxxxxx..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Token permanente gerado no Meta for Developers
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Testes realizados:</strong>
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                      <li>Validação do token de acesso</li>
                      <li>Verificação de permissões de mensagens</li>
                      <li>Confirmação do webhook configurado</li>
                    </ul>
                  </p>
                </div>
              </div>
            )}

            {/* Facebook Form */}
            {activeTab === 'facebook' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={facebookData.accessToken}
                    onChange={(e) => setFacebookData({ ...facebookData, accessToken: e.target.value })}
                    placeholder="EAAxxxxxxxxxx..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Token de longa duração (60 dias) do Meta for Developers
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad Account ID
                  </label>
                  <input
                    type="text"
                    value={facebookData.adAccountId}
                    onChange={(e) => setFacebookData({ ...facebookData, adAccountId: e.target.value })}
                    placeholder="act_1234567890 ou 1234567890"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ID da conta de anúncios (com ou sem prefixo &quot;act_&quot;)
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Testes realizados:</strong>
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                      <li>Validação do token de acesso</li>
                      <li>Verificação de acesso à conta de anúncios</li>
                      <li>Permissões de leitura de campanhas</li>
                      <li>Acesso aos insights/métricas</li>
                    </ul>
                  </p>
                </div>
              </div>
            )}

            {/* Hotmart Form */}
            {activeTab === 'hotmart' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL
                  </label>
                  <input
                    type="text"
                    value={hotmartData.webhookUrl}
                    onChange={(e) => setHotmartData({ ...hotmartData, webhookUrl: e.target.value })}
                    placeholder="https://seu-dominio.com/api/hotmart/webhook"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL onde a Hotmart enviará os eventos (deve ser HTTPS)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook Token (opcional)
                  </label>
                  <input
                    type="password"
                    value={hotmartData.webhookToken}
                    onChange={(e) => setHotmartData({ ...hotmartData, webhookToken: e.target.value })}
                    placeholder="token_secreto_123"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Token de segurança enviado no header &quot;hottok&quot; (recomendado)
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Testes realizados:</strong>
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                      <li>Validação do formato da URL (HTTPS obrigatório)</li>
                      <li>Verificação do token de segurança</li>
                      <li>Simulação de payload de venda</li>
                      <li>Confirmação do endpoint do webhook</li>
                    </ul>
                  </p>
                </div>
              </div>
            )}

            {/* Botão de Teste */}
            <button
              onClick={runTest}
              disabled={testing}
              className={`w-full mt-6 px-6 py-3 rounded-lg font-medium transition ${
                testing
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
              }`}
            >
              {testing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white dark:border-blue-200"></div>
                  Executando testes...
                </span>
              ) : (
                '🧪 Executar Testes'
              )}
            </button>
          </div>
        </div>

        {/* Resultados */}
        {results && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className={`p-4 ${
              results.success 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <p className={`font-semibold ${
                results.success 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {results.message}
              </p>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resultados dos Testes</h3>
              <div className="space-y-4">
                {results.tests.map((test, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      test.status === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">
                            {test.status === 'success' ? '✅' : '❌'}
                          </span>
                          <h4 className="font-semibold text-gray-900 dark:text-white">{test.name}</h4>
                        </div>
                        <p className={`mt-1 text-sm ${
                          test.status === 'success' 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {test.message}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                        {test.duration}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {results.success && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>✨ Próximo passo:</strong> As credenciais estão corretas! Agora você pode salvá-las
                    na página de <Link href="/settings" className="underline font-semibold">Configurações</Link> para
                    começar a rastrear suas métricas.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
