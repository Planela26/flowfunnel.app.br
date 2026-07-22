'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, DollarSign, MousePointerClick, Copy, Check,
  ExternalLink, Gift, ShoppingBag, Clock, CheckCircle, Send,
  ArrowUpRight, BarChart3, Target, Zap, Percent, TrendingDown,
  ChevronRight, Eye, Calendar, Megaphone, Wallet
} from 'lucide-react'

interface AffiliateInfo {
  id: string
  name: string
  email: string | null
  code: string
  discountPercent: number
  commissionPercent: number
  isActive: boolean
}

interface Stats {
  clicks: number
  sales: number
  totalCommission: number
  totalRevenue: number
}

interface Sale {
  id: string
  plan: string
  originalAmount: number
  discountedAmount: number
  commissionAmount: number
  createdAt: string
}

interface TimeseriesPoint {
  date: string
  clicks: number
  sales: number
  commission: number
  revenue: number
}

interface BreakdownData {
  byPlan: Record<string, { count: number; commission: number; revenue: number; originalAmount: number }>
  totalClicks: number
  totalSales: number
  totalCommission: number
  totalRevenue: number
  totalOriginalAmount: number
  totalDiscount: number
  conversionRate: number
  avgCommission: number
}

const PLAN_LABELS: Record<string, string> = { START: 'START R$97', PRO: 'PRO R$147', SCALE: 'SCALE R$297' }
const PLAN_COLORS: Record<string, string> = {
  START: 'bg-blue-500',
  PRO: 'bg-purple-500',
  SCALE: 'bg-orange-500',
  OUTRO: 'bg-gray-500',
}
const PLAN_BG_COLORS: Record<string, string> = {
  START: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  PRO: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  SCALE: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  OUTRO: 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

const GOALS = [
  { name: 'R$100', value: 100, icon: Target },
  { name: 'R$500', value: 500, icon: TrendingUp },
  { name: 'R$1.000', value: 1000, icon: Zap },
  { name: 'R$2.500', value: 2500, icon: Megaphone },
  { name: 'R$5.000', value: 5000, icon: Wallet },
  { name: 'R$10.000', value: 10000, icon: DollarSign },
]

function formatDateBR(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function getNextGoal(totalCommission: number) {
  for (const g of GOALS) {
    if (totalCommission < g.value) return g
  }
  return null
}

function getCompletedGoal(totalCommission: number) {
  const completed = GOALS.filter(g => totalCommission >= g.value)
  return completed[completed.length - 1] || null
}

export default function AffiliatePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [affiliate, setAffiliate] = useState<AffiliateInfo | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([])
  const [breakdown, setBreakdown] = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'sales'>('overview')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status !== 'authenticated') return

    const load = async () => {
      setLoading(true)
      try {
        const [meRes, tsRes, bdRes] = await Promise.all([
          fetch('/api/affiliate/me'),
          fetch('/api/affiliate/me/timeseries?days=30'),
          fetch('/api/affiliate/me/breakdown'),
        ])
        const [meData, tsData, bdData] = await Promise.all([
          meRes.json(),
          tsRes.json(),
          bdRes.json(),
        ])
        setAffiliate(meData.affiliate)
        setStats(meData.stats)
        setRecentSales(meData.recentSales || [])
        setTimeseries(tsData.data || [])
        setBreakdown(bdData)
      } catch (e) {
        console.error('Erro ao carregar afiliado:', e)
      }
      setLoading(false)
    }
    load()
  }, [status])

  const affiliateLink = affiliate
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${affiliate.code}`
    : ''

  const copyLink = () => {
    navigator.clipboard.writeText(affiliateLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const requestAffiliate = async () => {
    setSending(true)
    await fetch('/api/affiliate/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    setSent(true)
    setSending(false)
  }

  if (status === 'loading' || loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Gift className="w-6 h-6 text-purple-600" />
            Programa de Afiliados
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Ganhe comissões indicando o FlowFunnel para outros infoprodutores
          </p>
        </div>

        {!affiliate ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8">
            {sent ? (
              <div className="text-center">
                <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Solicitação enviada!</h2>
                <p className="text-gray-500 dark:text-gray-400">Nossa equipe analisará sua solicitação e entrará em contato em até 48 horas.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-6 mb-8">
                  {[
                    { icon: TrendingUp, label: 'Comissão por venda', value: 'Até 30%', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                    { icon: DollarSign, label: 'Desconto para indicados', value: 'Até 20%', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { icon: MousePointerClick, label: 'Link personalizado', value: 'Rastreado', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                  ].map(({ icon: Icon, label, value, color, bg }) => (
                    <div key={label} className={`flex-1 ${bg} rounded-xl p-4 flex items-center gap-3`}>
                      <Icon className={`w-8 h-8 ${color}`} />
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                        <div className={`text-lg font-bold ${color}`}>{value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Quero ser afiliado</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Preencha o formulário abaixo. Após aprovação, você receberá seu link e código de afiliado.
                </p>
                <textarea
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Conte um pouco sobre você e como pretende divulgar o FlowFunnel..."
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-gray-400 resize-none mb-4"
                />
                <button
                  onClick={requestAffiliate}
                  disabled={sending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Enviando...' : 'Enviar solicitação'}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Paused Banner */}
            {!affiliate.isActive && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3 mb-6 flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
                <Clock className="w-4 h-4 flex-shrink-0" />
                Sua conta de afiliado está temporariamente pausada. Entre em contato com o suporte.
              </div>
            )}

            {/* Affiliate Link Card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 mb-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Seu link de afiliado</h2>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 font-mono truncate">
                  {affiliateLink}
                </div>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition whitespace-nowrap"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar link'}
                </button>
                <a href={affiliateLink} target="_blank" className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 transition whitespace-nowrap">
                  <ExternalLink className="w-4 h-4" /> Abrir
                </a>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>Código: <strong className="text-gray-900 dark:text-white font-mono">{affiliate.code}</strong></span>
                <span>Desconto: <strong className="text-green-600">{affiliate.discountPercent}%</strong></span>
                <span>Comissão: <strong className="text-purple-600">{affiliate.commissionPercent}%</strong></span>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6">
              {([
                { key: 'overview', label: 'Visão Geral', icon: BarChart3 },
                { key: 'analytics', label: 'Analytics', icon: TrendingUp },
                { key: 'sales', label: 'Vendas', icon: ShoppingBag },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                    activeTab === key
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Cliques', value: stats?.clicks ?? 0, icon: MousePointerClick, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Vendas', value: stats?.sales ?? 0, icon: ShoppingBag, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                    { label: 'Comissão', value: `R$ ${(stats?.totalCommission ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                    { label: 'Receita', value: `R$ ${(stats?.totalRevenue ?? 0).toFixed(2)}`, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                  ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-3">
                      <div className={`${bg} p-2.5 rounded-xl`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress + Goal */}
                {stats && breakdown && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        Progresso de Comissões
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      {GOALS.map((g, i) => {
                        const completed = stats.totalCommission >= g.value
                        const isNext = getNextGoal(stats.totalCommission)?.value === g.value
                        const isCurrent = getCompletedGoal(stats.totalCommission)?.value === g.value
                        return (
                          <div key={g.name} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${
                            completed ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' : isNext ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 ring-2 ring-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            <g.icon className="w-3 h-3" />
                            {g.name}
                            {completed && <Check className="w-3 h-3 ml-0.5" />}
                          </div>
                        )
                      })}
                    </div>

                    {(() => {
                      const next = getNextGoal(stats.totalCommission)
                      const completed = getCompletedGoal(stats.totalCommission)
                      if (!next) return (
                        <div className="text-center py-4">
                          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="text-lg font-bold text-green-600">Você atingiu todas as metas! 🎉</p>
                        </div>
                      )
                      const progress = Math.min((stats.totalCommission / next.value) * 100, 100)
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500">
                              Próxima meta: <strong className="text-gray-900">{next.name}</strong>
                            </span>
                            <span className="text-sm font-bold text-purple-600">
                              R$ {stats.totalCommission.toFixed(2)} / R$ {next.value}
                            </span>
                          </div>
                          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                            <span>Taxa de conversão: {breakdown.conversionRate.toFixed(1)}%</span>
                            <span>Comissão média: R$ {breakdown.avgCommission.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Recent Sales */}
                {recentSales.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-purple-600" />
                        Vendas Recentes
                      </h2>
                      <button
                        onClick={() => setActiveTab('sales')}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                      >
                        Ver todas <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          <tr>
                            <th className="px-6 py-3 text-left">Plano</th>
                            <th className="px-6 py-3 text-right">Valor</th>
                            <th className="px-6 py-3 text-right">Comissão</th>
                            <th className="px-6 py-3 text-right">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                          {recentSales.slice(0, 5).map(sale => (
                            <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-6 py-3">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_BG_COLORS[sale.plan] || PLAN_BG_COLORS.OUTRO}`}>
                                  {sale.plan}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-right text-sm text-gray-900">
                                R$ {sale.discountedAmount.toFixed(2)}
                              </td>
                              <td className="px-6 py-3 text-right text-sm font-bold text-green-600">
                                +R$ {sale.commissionAmount.toFixed(2)}
                              </td>
                              <td className="px-6 py-3 text-right text-xs text-gray-400">
                                {new Date(sale.createdAt).toLocaleDateString('pt-BR')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                {/* Clicks Chart */}
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Cliques (30 dias)
                  </h3>
                  {timeseries.length > 0 ? (
                    <div>
                      <div className="flex items-end gap-0.5 h-48 mb-2">
                        {timeseries.map((point, i) => {
                          const maxClicks = Math.max(...timeseries.map(p => p.clicks), 1)
                          const height = maxClicks > 0 ? (point.clicks / maxClicks) * 100 : 0
                          const hasSale = point.sales > 0
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                              <div className="relative w-full flex flex-col items-center">
                                <div className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition absolute -top-4 whitespace-nowrap">
                                  {point.clicks}
                                </div>
                                <div
                                  className={`w-full rounded-t-sm transition-all hover:opacity-80 ${hasSale ? 'bg-blue-600' : 'bg-blue-300'}`}
                                  style={{ height: `${Math.max(height, 1)}%` }}
                                  title={`${formatDateBR(point.date)}: ${point.clicks} cliques${point.sales > 0 ? `, ${point.sales} vendas` : ''}`}
                                />
                              </div>
                              {i % 7 === 0 && (
                                <span className="text-[9px] text-gray-400 mt-1">{formatDateBR(point.date)}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-blue-600 rounded-sm" />
                          <span>Clique com venda</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-blue-300 rounded-sm" />
                          <span>Clique sem venda</span>
                        </div>
                        <span className="ml-auto">
                          Total: {timeseries.reduce((s, p) => s + p.clicks, 0)} cliques | {timeseries.reduce((s, p) => s + p.sales, 0)} vendas
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-500">
                      <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p>Nenhum dado de cliques nos últimos 30 dias</p>
                    </div>
                  )}
                </div>

                {/* Breakdown by Plan */}
                {breakdown && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Percent className="w-5 h-5 text-purple-600" />
                      Desempenho por Plano
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(['START', 'PRO', 'SCALE'] as const).map(plan => {
                        const data = breakdown.byPlan[plan]
                        if (!data || data.count === 0) return (
                          <div key={plan} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                            <span className="text-xs font-bold text-gray-400">{plan}</span>
                            <p className="text-sm text-gray-400 mt-2">Nenhuma venda</p>
                          </div>
                        )
                        const planTotal = breakdown.byPlan.START?.count + breakdown.byPlan.PRO?.count + breakdown.byPlan.SCALE?.count || 1
                        const share = Math.round((data.count / planTotal) * 100)
                        return (
                          <div key={plan} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${PLAN_BG_COLORS[plan]}`}>{plan}</span>
                              <span className="text-xs text-gray-400">{share}% das vendas</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Vendas</span>
                                <span className="font-bold text-gray-900">{data.count}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Comissão</span>
                                <span className="font-bold text-green-600">R$ {data.commission.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Receita</span>
                                <span className="font-bold text-gray-900">R$ {data.revenue.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Desconto</span>
                                <span className="font-bold text-red-500">- R$ {(data.originalAmount - data.revenue).toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${PLAN_COLORS[plan]}`} style={{ width: `${share}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Conversion Stats */}
                {breakdown && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{breakdown.conversionRate.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500 mt-1">Taxa de conversão</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">R$ {breakdown.avgCommission.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">Comissão média</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">R$ {breakdown.totalDiscount.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">Total descontado</div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">R$ {breakdown.totalOriginalAmount.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">Valor original</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SALES TAB */}
            {activeTab === 'sales' && (
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-purple-600" />
                    Todas as Vendas
                  </h2>
                </div>
                {recentSales.length === 0 ? (
                  <div className="py-12 text-center">
                    <ShoppingBag className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Nenhuma venda ainda. Compartilhe seu link!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        <tr>
                          <th className="px-6 py-3 text-left">Plano</th>
                          <th className="px-6 py-3 text-right">Original</th>
                          <th className="px-6 py-3 text-right">Desconto</th>
                          <th className="px-6 py-3 text-right">Pago</th>
                          <th className="px-6 py-3 text-right">Comissão</th>
                          <th className="px-6 py-3 text-right">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {recentSales.map(sale => {
                          const discount = sale.originalAmount - sale.discountedAmount
                          return (
                            <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-6 py-4">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_BG_COLORS[sale.plan] || PLAN_BG_COLORS.OUTRO}`}>
                                  {sale.plan}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-gray-500 line-through">
                                R$ {sale.originalAmount.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-red-500">
                                - R$ {discount.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                                R$ {sale.discountedAmount.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                                +R$ {sale.commissionAmount.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-right text-xs text-gray-400">
                                {new Date(sale.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
