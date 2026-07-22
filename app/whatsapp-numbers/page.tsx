'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePlan } from '@/components/usePlan'
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  Star,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle,
  Phone,
  Loader2,
  Crown,
} from 'lucide-react'

interface WhatsAppNumber {
  id: string
  nickname: string
  phoneNumberId: string
  businessAccountId: string
  connectedAt: string
  connectionType?: string
  isDefault: boolean
  stats?: {
    conversasIniciadas: number
    conversasAbandonadas: number
    leadsQualificados: number
    mediaPorDia: number
    totalMensagens: number
    taxaResposta: string
    tempoMedioResposta: string
  }
}

// -1 = ilimitado (usado pelo SCALE). Mantém alinhado com lib/plans.ts → PLAN_WHATSAPP_LIMITS
const PLAN_LIMITS: Record<string, number> = {
  FREE: 1,
  START: 1,
  PRO: 3,
  SCALE: -1,
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito',
  START: 'START',
  PRO: 'PRO',
  SCALE: 'SCALE',
}

export default function WhatsAppNumbersPage() {
  const { info: planInfo } = usePlan()
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const userPlan = planInfo.plan
  const isStartPlan = userPlan === 'START'
  const isProOrScale = userPlan === 'PRO' || userPlan === 'SCALE'
  const limit = PLAN_LIMITS[userPlan] ?? 1
  const isUnlimited = limit === -1
  const isAtLimit = !isUnlimited && numbers.length >= limit

  const fetchNumbers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/integrations/whatsapp')
      const data = await res.json()
      if (data.numbers) {
        setNumbers(data.numbers)
      } else {
        setNumbers([])
      }
    } catch {
      setError('Erro ao carregar números')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNumbers() }, [])

  const setDefault = async (id: string) => {
    setActionLoading(id + '-default')
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/integrations/whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: id }),
      })
      if (res.ok) {
        setNumbers((prev) => prev.map((n) => ({ ...n, isDefault: n.id === id })))
        setSuccess('Número padrão atualizado com sucesso.')
      }
    } catch {
      setError('Erro ao definir número padrão.')
    } finally {
      setActionLoading(null)
    }
  }

  const disconnect = async (id: string, nickname: string) => {
    if (!confirm(`Desconectar "${nickname}"? Os dados históricos serão preservados.`)) return
    setActionLoading(id + '-delete')
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/integrations/whatsapp?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNumbers((prev) => prev.filter((n) => n.id !== id))
        setSuccess(`"${nickname}" desconectado com sucesso.`)
      }
    } catch {
      setError('Erro ao desconectar número.')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch { return '—' }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Números de WhatsApp</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Start mantém a visualização atual. Pro e Scale usam a conexão oficial do WhatsApp Business com conta verificada.</p>
            </div>
          </div>

          {/* Limite do plano */}
          <div className="flex items-center gap-2">
            <div className={`text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
              isAtLimit
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            }`}>
              <Phone className="w-3.5 h-3.5" />
                {numbers.length} / {isUnlimited ? '∞' : limit} números
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Alerta de feedback */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 text-sm text-green-700 dark:text-green-400">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Card de limite do plano */}
        {isStartPlan && (
          <div className={`rounded-xl border p-5 flex items-start gap-4 ${
            isAtLimit
              ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-700'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isAtLimit ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-green-100 dark:bg-green-900/30'
          }`}>
            <Crown className={`w-5 h-5 ${isAtLimit ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-gray-900 dark:text-white text-sm">
                Plano {PLAN_LABELS.START}
              </p>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {PLAN_LABELS.START}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No Start, a área segue como visualização de funil. Faça upgrade para Pro ou Scale e conecte o WhatsApp Business oficial com métricas avançadas.
            </p>
            <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Benefícios do Scale</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Acesso aos números conectados, insights mais profundos do WhatsApp, análise por IA e experiência premium com conta verificada.
              </p>
            </div>
            {isAtLimit && !isUnlimited && (
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1 font-medium">
                Limite atingido. Faça upgrade para adicionar mais números.
              </p>
            )}
          </div>
          {isAtLimit && !isUnlimited && (
            <Link
              href="/billing"
              className="shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
            >
              Upgrade
            </Link>
          )}
          </div>
        )}

        {isStartPlan && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 via-white to-yellow-50 dark:from-amber-950/30 dark:via-gray-800 dark:to-yellow-950/20 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 via-amber-500 to-amber-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
              <Crown className="w-6 h-6 text-white drop-shadow" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Pro + Scale</p>
              <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1">WhatsApp oficial com métricas avançadas</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-2xl">
                No Start, nada muda. No Pro e no Scale, você conecta a API oficial da Meta e acompanha métricas mais profundas de conversas, origem e qualidade.
              </p>
              <div className="grid gap-3 sm:grid-cols-3 mt-4">
                {[
                  'Conexão oficial do WhatsApp Business',
                  'Métricas avançadas e mais profundidade',
                  'IA e insights premium no Scale',
                ].map((item) => (
                  <div key={item} className="rounded-xl bg-white/80 dark:bg-gray-900/50 border border-amber-100 dark:border-amber-900 p-3 text-sm text-gray-700 dark:text-gray-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Lista de números */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        ) : numbers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 dark:text-white text-lg">Nenhum número conectado</p>
                {isStartPlan ? (
                  <>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      No Start, esta área mostra apenas a visualização do funil. Para conexão oficial, use Pro ou Scale.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3 mt-4">
                      {[
                        'Visualização atual do funil',
                        'Sem conexão oficial neste plano',
                        'Upgrade para Pro ou Scale para integrar',
                      ].map((item) => (
                        <div key={item} className="rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-700 dark:text-gray-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </>
                ) : isProOrScale ? (
                  <>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Seu plano <strong>{userPlan}</strong> libera a conexão oficial do WhatsApp Business. Conecte sua conta verificada para começar a ver números, status, origem das conversas e insights avançados.
                    </p>
                    <Link
                      href="/whatsapp-connect"
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition"
                    >
                      <Plus className="w-4 h-4" />
                      Conectar WhatsApp Business
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Quando você estiver no Pro ou Scale com conta verificada, essa área mostra números, status, origem das conversas e insights avançados.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {numbers.map((num) => {
              const isLoadingDefault = actionLoading === num.id + '-default'
              const isLoadingDelete = actionLoading === num.id + '-delete'
              return (
                <div
                  key={num.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border p-5 transition ${
                    num.isDefault
                      ? 'border-green-400 dark:border-green-600 ring-1 ring-green-400/30'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        num.isDefault ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <MessageCircle className={`w-5 h-5 ${num.isDefault ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{num.nickname}</p>
                          {num.isDefault && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <Star className="w-3 h-3" /> Padrão
                            </span>
                          )}
                          {num.connectionType === 'SIMPLE' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              📱 Visualização
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              <Shield className="w-3 h-3" /> API oficial
                            </span>
                          )}
                        </div>
                        {num.connectionType !== 'SIMPLE' && (
                          <>
                            <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                              Phone ID: {num.phoneNumberId}
                            </p>
                            <p className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">
                              WABA ID: {num.businessAccountId}
                            </p>
                          </>
                        )}
                        {num.connectedAt && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Conectado em {formatDate(num.connectedAt)}
                          </p>
                        )}

                        {num.stats && num.connectionType !== 'SIMPLE' && (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Iniciadas</p>
                              <p className="text-base font-black text-gray-900 dark:text-white">{num.stats.conversasIniciadas.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-orange-700 dark:text-orange-400 font-semibold">Abandonadas</p>
                              <p className="text-base font-black text-orange-700 dark:text-orange-400">{num.stats.conversasAbandonadas.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold">Qualificadas</p>
                              <p className="text-base font-black text-emerald-700 dark:text-emerald-400">{num.stats.leadsQualificados.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-400 font-semibold">Média/dia</p>
                              <p className="text-base font-black text-blue-700 dark:text-blue-400">{num.stats.mediaPorDia.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Mensagens</p>
                              <p className="text-base font-black text-gray-900 dark:text-white">{num.stats.totalMensagens.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Taxa resp.</p>
                              <p className="text-base font-black text-gray-900 dark:text-white">{num.stats.taxaResposta}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-2 col-span-2">
                              <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Tempo médio resposta</p>
                              <p className="text-base font-black text-gray-900 dark:text-white">{num.stats.tempoMedioResposta}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!num.isDefault && (
                        <button
                          onClick={() => setDefault(num.id)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 rounded-lg transition disabled:opacity-50"
                        >
                          {isLoadingDefault ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                          {isLoadingDefault ? 'Definindo...' : 'Definir padrão'}
                        </button>
                      )}
                      <button
                        onClick={() => disconnect(num.id, num.nickname)}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg transition disabled:opacity-50"
                      >
                        {isLoadingDelete ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        {isLoadingDelete ? 'Removendo...' : 'Desconectar'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && isAtLimit && !isUnlimited && (
          <div className="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Limite do plano atingido</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {userPlan === 'START' || userPlan === 'FREE'
                  ? 'Faça upgrade para o PRO ou SCALE para ampliar recursos, números e insights.'
                  : 'Faça upgrade para o SCALE e conecte números ilimitados.'}
              </p>
            </div>
            <Link
              href="/billing"
              className="shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
            >
              Ver planos
            </Link>
          </div>
        )}

        {/* Sobre o webhook */}
        {numbers.length > 0 && numbers.some(n => n.connectionType !== 'SIMPLE') && (
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Webhook único para todos os números</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Todos os números usam o mesmo endpoint de webhook:{' '}
                <code className="font-mono bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-xs">/api/webhooks/whatsapp</code>.
                O sistema identifica automaticamente de qual número veio cada mensagem pelo <code className="font-mono bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-xs">phoneNumberId</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
