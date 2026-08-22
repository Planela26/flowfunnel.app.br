'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PLAN_PRICES_BRL, getPlanPriceBRL } from '@/lib/plans'
import {
  Users, DollarSign, TrendingUp, Crown, Search, RefreshCw,
  UserCheck, UserX, BarChart2, ArrowUpRight, Calendar, Zap,
  Clock, Mail, CreditCard, Gift, AlertTriangle, CheckCircle,
  Filter, ChevronDown, Clock as ClockIcon, Ban, Trash2, RotateCcw, X
} from 'lucide-react'

interface User {
  id: string
  publicId: string | null
  name: string | null
  email: string | null
  plan: string
  role: string
  createdAt: string
  stripeSubscriptionId: string | null
  emailVerified: string | null
  trialStatus: string | null
  trialStartedAt: string | null
  trialEndsAt: string | null
  trialPlan: string | null
  subscriptionStatus: string | null
  gracePeriodEndsAt: string | null
  deactivatedAt: string | null
  deactivatedReason: string | null
  _count: { integrations: number; webhookLogs: number }
}

interface Stats {
  total: number
  byPlan: { FREE: number; START: number; PRO: number; SCALE: number }
  mrr: number
}

interface TrialStats {
  totalUsers: number
  pendingEmail: number
  pendingPayment: number
  activeTrial: number
  expiredTrial: number
  convertedTrial: number
  noneTrial: number
  activeWithPlan: number
  trialStartedThisMonth: number
  trialStartedThisWeek: number
  trialStartedToday: number
  totalTrialsEver: number
  conversionRate: number
  avgDaysToTrial: number
  emailVerified: number
  emailNotVerified: number
}

interface ChurnMetrics {
  mrr: number
  arr: number
  churnRate: number
  totalUsers: number
  payingUsers: number
  freeUsers: number
  payingRatio: number
  verifiedRate: number
  activeTrials: number
  trialConversionRate: number
  thisMonthSignups: number
  lastMonthSignups: number
  signupGrowth: number
  revenueByPlan: { START: number; PRO: number; SCALE: number }
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  START: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PRO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  SCALE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
}

const PLAN_BAR_COLORS: Record<string, string> = {
  FREE: 'bg-gray-400',
  START: 'bg-blue-500',
  PRO: 'bg-purple-500',
  SCALE: 'bg-orange-500',
}

/** Moeda com centavos: sem as opções, 143.7 sairia como "143,7". */
const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TRIAL_STATUS_LABELS: Record<string, string> = {
  none: 'Sem trial',
  pending_email: 'Email pendente',
  pending_payment: 'Pagamento pendente',
  active: 'Trial ativo',
  expired: 'Trial expirado',
  converted: 'Trial convertido',
}

const TRIAL_STATUS_COLORS: Record<string, string> = {
  none: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  pending_email: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  pending_payment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  converted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  // Instante em que a tela abriu, capturado UMA vez. Usado pelo corte de
  // "últimos 7 dias" mais abaixo, que antes chamava Date.now() no render.
  const [abertoEm] = useState(() => Date.now())
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [trialStats, setTrialStats] = useState<TrialStats | null>(null)
  const [churn, setChurn] = useState<ChurnMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [trialFilter, setTrialFilter] = useState('all')
  const [activeSection, setActiveSection] = useState<'overview' | 'trials' | 'churn'>('overview')

  // Ações destrutivas sobre uma conta. `modal` guarda qual ação está sendo
  // confirmada e sobre quem — nada acontece direto do clique na linha.
  const [modal, setModal] = useState<{ kind: 'delete' | 'deactivate'; user: User } | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState('')

  const meuId = (session?.user as any)?.id as string | undefined

  const abrirModal = (kind: 'delete' | 'deactivate', user: User) => {
    setModal({ kind, user })
    setConfirmText('')
    setReason('')
    setActionError('')
  }

  const fecharModal = () => {
    if (acting) return
    setModal(null)
    setActionError('')
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, trialRes, churnRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/trial-stats'),
        fetch('/api/admin/churn-metrics'),
      ])
      const [usersData, trialData, churnData] = await Promise.all([
        usersRes.json(),
        trialRes.json(),
        churnRes.json(),
      ])
      setUsers(usersData.users || [])
      setStats(usersData.stats || null)
      setTrialStats(trialData)
      setChurn(churnData)
    } catch (e) {
      console.error('Erro ao carregar dados:', e)
    }
    setLoading(false)
  }

  // Este efeito ficava ACIMA de `fetchData`, que é um `const`. Funcionava por
  // acaso: o corpo do efeito só roda depois da montagem, quando a constante já
  // recebeu valor. Mas qualquer mudança que o fizesse rodar mais cedo
  // encontraria a variável na zona morta temporal. Declarar antes de usar
  // elimina a dependência dessa ordem.
  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      if ((session?.user as any)?.role !== 'ADMIN') { router.push('/dashboard'); return }
      fetchData()
    }
  }, [status, session])

  /** Lê a mensagem do backend antes de decidir o que mostrar — o 409 de conta
   *  ativa traz o motivo exato (assinatura, carência ou teste), e engolir isso
   *  em um "erro ao apagar" genérico esconderia justamente o que o admin
   *  precisa saber para agir. */
  const chamar = async (url: string, init: RequestInit) => {
    const res = await fetch(url, init)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || data.error || 'Não foi possível concluir a operação.')
    return data
  }

  const desativar = async (user: User, motivo: string) => {
    setActing(true); setActionError('')
    try {
      await chamar(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', reason: motivo }),
      })
      setModal(null)
      await fetchData()
    } catch (e: any) {
      setActionError(e.message)
    }
    setActing(false)
  }

  const reativar = async (user: User) => {
    setActing(true); setActionError('')
    try {
      await chamar(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      })
      await fetchData()
    } catch (e: any) {
      alert(e.message)
    }
    setActing(false)
  }

  const apagar = async (user: User, confirmacao: string) => {
    setActing(true); setActionError('')
    try {
      // O e-mail digitado vai na URL porque o servidor o exige para concluir —
      // a rota recusa qualquer DELETE cuja confirmação não bata exatamente.
      await chamar(
        `/api/admin/users/${user.id}?confirm=${encodeURIComponent(confirmacao)}`,
        { method: 'DELETE' },
      )
      setModal(null)
      await fetchData()
    } catch (e: any) {
      setActionError(e.message)
    }
    setActing(false)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.publicId || '').toLowerCase().includes(q)
    const matchPlan = planFilter === 'all' || u.plan === planFilter
    const matchTrial = trialFilter === 'all' || (u.trialStatus || 'none') === trialFilter
    return matchSearch && matchPlan && matchTrial
  })

  const pagantes = stats ? stats.byPlan.START + stats.byPlan.PRO + stats.byPlan.SCALE : 0
  const convRate = stats && stats.total > 0 ? Math.round((pagantes / stats.total) * 100) : 0
  const arr = stats ? stats.mrr * 12 : 0

  // `Date.now()` ficava dentro do filtro, ou seja, dentro do render: dois
  // renders seguidos podiam produzir listas diferentes sem nada ter mudado.
  // Fixando o instante no mount, o corte de 7 dias fica estável enquanto a
  // tela estiver aberta — que é o comportamento que se espera de um painel.
  const last7 = users.filter(u => {
    const d = new Date(u.createdAt)
    return (abertoEm - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  })

  const maxPlanCount = stats ? Math.max(stats.byPlan.FREE, stats.byPlan.START, stats.byPlan.PRO, stats.byPlan.SCALE, 1) : 1

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-600" />
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Visão geral da plataforma</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-6">
          {([
            { key: 'overview', label: 'Visão Geral', icon: BarChart2 },
            { key: 'trials', label: 'Trials', icon: Gift },
            { key: 'churn', label: 'Churn & MRR', icon: TrendingUp },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeSection === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW SECTION */}
        {activeSection === 'overview' && (
          <>
            {/* KPI Cards */}
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: 'Usuários totais',
                    value: stats.total,
                    sub: `+${last7.length} esta semana`,
                    icon: Users,
                    color: 'text-blue-600',
                    bg: 'bg-blue-50 dark:bg-blue-900/20',
                  },
                  {
                    label: 'MRR',
                    value: `R$ ${stats.mrr.toLocaleString('pt-BR')}`,
                    sub: `ARR: R$ ${arr.toLocaleString('pt-BR')}`,
                    icon: DollarSign,
                    color: 'text-green-600',
                    bg: 'bg-green-50 dark:bg-green-900/20',
                  },
                  {
                    label: 'Usuários pagantes',
                    value: pagantes,
                    sub: `${convRate}% de conversão`,
                    icon: Crown,
                    color: 'text-purple-600',
                    bg: 'bg-purple-50 dark:bg-purple-900/20',
                  },
                  {
                    label: 'Usuários FREE',
                    value: stats.byPlan.FREE,
                    sub: `${stats.total > 0 ? Math.round((stats.byPlan.FREE / stats.total) * 100) : 0}% do total`,
                    icon: UserX,
                    color: 'text-gray-500',
                    bg: 'bg-gray-100 dark:bg-gray-800',
                  },
                ].map(({ label, value, sub, icon: Icon, color, bg }) => (
                  <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                      <div className={`${bg} p-2 rounded-lg`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Plan Distribution */}
              {stats && (
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Distribuição por plano
                  </h3>
                  <div className="space-y-4">
                    {(['SCALE', 'PRO', 'START', 'FREE'] as const).map(plan => {
                      const count = stats.byPlan[plan]
                      const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                      const rev = count * PLAN_PRICES_BRL[plan]
                      return (
                        <div key={plan}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[plan]}`}>{plan}</span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{count} usuários</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {rev > 0 && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  R$ {brl(rev)}/mês
                                </span>
                              )}
                              <span className="text-xs text-gray-400 dark:text-gray-500">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${PLAN_BAR_COLORS[plan]}`}
                              style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">MRR Total</span>
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">
                        R$ {stats.mrr.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400 dark:text-gray-500">ARR projetado</span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        R$ {arr.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent signups */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Últimos cadastros
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                ) : last7.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-6">Nenhum novo cadastro esta semana</p>
                ) : (
                  <div className="space-y-3">
                    {last7.slice(0, 6).map(u => (
                      <div key={u.id} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                            {(u.name || u.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{u.name || u.email}</p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(u.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </p>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PLAN_COLORS[u.plan] || PLAN_COLORS.FREE}`}>
                          {u.plan}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* TRIALS SECTION */}
        {activeSection === 'trials' && trialStats && (
          <div className="space-y-6 mb-6">
            {/* Trial KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Trial Ativos', value: trialStats.activeTrial, sub: `${trialStats.activeWithPlan} com plano`, icon: Gift, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Convertidos', value: trialStats.convertedTrial, sub: `${trialStats.conversionRate}% de conversão`, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Expirados', value: trialStats.expiredTrial, sub: 'sem conversão', icon: Clock, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
                { label: 'Email Pendente', value: trialStats.pendingEmail, sub: `${trialStats.emailNotVerified} não verificados`, icon: Mail, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
              ].map(({ label, value, sub, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                    <div className={`${bg} p-2 rounded-lg`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>
                </div>
              ))}
            </div>

            {/* Trial Funnel */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                Funil do Trial
              </h3>
              <div className="flex items-center gap-4 flex-wrap">
                {([
                  { label: 'Total', value: trialStats.totalUsers, color: 'bg-gray-500' },
                  { label: 'Verificou Email', value: trialStats.emailVerified, color: 'bg-blue-500' },
                  { label: 'Pagamento Pendente', value: trialStats.pendingPayment, color: 'bg-orange-500' },
                  { label: 'Trial Ativo', value: trialStats.activeTrial, color: 'bg-green-500' },
                  { label: 'Convertido', value: trialStats.convertedTrial, color: 'bg-blue-600' },
                ]).map((step, i) => {
                  const pct = trialStats.totalUsers > 0 ? Math.round((step.value / trialStats.totalUsers) * 100) : 0
                  return (
                    <div key={step.label} className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-full ${step.color} flex items-center justify-center text-white font-bold text-sm`}>
                          {step.value}
                        </div>
                        <span className="text-xs text-gray-500 mt-1">{step.label}</span>
                        <span className="text-[10px] text-gray-400">{pct}%</span>
                      </div>
                      {i < 4 && <ArrowUpRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Trial Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Atividade Recent
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Hoje</span>
                    <span className="font-bold text-gray-900">{trialStats.trialStartedToday}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Esta semana</span>
                    <span className="font-bold text-gray-900">{trialStats.trialStartedThisWeek}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Este mês</span>
                    <span className="font-bold text-gray-900">{trialStats.trialStartedThisMonth}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">Total de trials</span>
                    <span className="font-bold text-blue-600">{trialStats.totalTrialsEver}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Tempo até o trial
                </h3>
                <div className="text-center py-4">
                  <div className="text-3xl font-black text-blue-600">{trialStats.avgDaysToTrial}</div>
                  <p className="text-sm text-gray-500 mt-1">dias em média</p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Status Geral
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Verificados</span>
                    <span className="font-medium text-gray-900">{trialStats.emailVerified}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Não verificados</span>
                    <span className="font-medium text-gray-900">{trialStats.emailNotVerified}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Sem trial</span>
                    <span className="font-medium text-gray-900">{trialStats.noneTrial}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHURN SECTION */}
        {activeSection === 'churn' && churn && (
          <div className="space-y-6 mb-6">
            {/* Churn KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'MRR', value: `R$ ${churn.mrr.toLocaleString('pt-BR')}`, sub: `ARR: R$ ${churn.arr.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Churn Rate', value: `${churn.churnRate}%`, sub: 'usuários FREE', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
                { label: 'Trial Conversão', value: `${churn.trialConversionRate}%`, sub: 'de trial para pago', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Crescimento', value: `${churn.signupGrowth > 0 ? '+' : ''}${churn.signupGrowth}%`, sub: `${churn.thisMonthSignups} este mês`, icon: ArrowUpRight, color: churn.signupGrowth >= 0 ? 'text-green-600' : 'text-red-500', bg: churn.signupGrowth >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20' },
              ].map(({ label, value, sub, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                    <div className={`${bg} p-2 rounded-lg`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>
                </div>
              ))}
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Receita por Plano
                </h3>
                <div className="space-y-4">
                  {(['START', 'PRO', 'SCALE'] as const).map(plan => {
                    const rev = churn.revenueByPlan[plan]
                    const total = churn.revenueByPlan.START + churn.revenueByPlan.PRO + churn.revenueByPlan.SCALE
                    const pct = total > 0 ? Math.round((rev / total) * 100) : 0
                    return (
                      <div key={plan}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold ${PLAN_COLORS[plan]}`}>{plan}</span>
                          <span className="text-sm font-bold text-gray-900">R$ {rev.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${PLAN_BAR_COLORS[plan]}`}
                            style={{ width: `${Math.max(pct, rev > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 text-right">{pct}%</div>
                      </div>
                    )
                  })}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Total</span>
                      <span className="text-lg font-bold text-green-600">
                        R$ {churn.mrr.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Métricas de Saúde
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Taxa de pagamento</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${churn.payingRatio}%` }} />
                      </div>
                      <span className="text-sm font-bold">{churn.payingRatio}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Email verificado</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${churn.verifiedRate}%` }} />
                      </div>
                      <span className="text-sm font-bold">{churn.verifiedRate}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Cadastros este mês</span>
                    <span className="text-sm font-bold text-gray-900">{churn.thisMonthSignups}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Cadastros mês passado</span>
                    <span className="text-sm font-bold text-gray-900">{churn.lastMonthSignups}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Trials ativos</span>
                    <span className="text-sm font-bold text-blue-600">{churn.activeTrials}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou ID (FLS-...)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">Todos os planos</option>
            <option value="FREE">FREE</option>
            <option value="START">START</option>
            <option value="PRO">PRO</option>
            <option value="SCALE">SCALE</option>
          </select>
          <select
            value={trialFilter}
            onChange={e => setTrialFilter(e.target.value)}
            className="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">Todos os trials</option>
            <option value="none">Sem trial</option>
            <option value="pending_email">Email pendente</option>
            <option value="pending_payment">Pagamento pendente</option>
            <option value="active">Trial ativo</option>
            <option value="expired">Trial expirado</option>
            <option value="converted">Trial convertido</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Usuários ({filtered.length})
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Usuário</th>
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">ID Público</th>
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Plano</th>
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Trial</th>
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Email</th>
                    <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">MRR</th>
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Integrações</th>
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Webhooks</th>
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Cadastro</th>
                    <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Assinatura</th>
                    <th className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, i) => (
                    <tr key={user.id} className={`border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${user.deactivatedAt ? 'bg-red-50/40 dark:bg-red-900/10' : i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-800/10'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                              {(user.name || user.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name || '—'}
                              {user.deactivatedAt && (
                                <span
                                  title={user.deactivatedReason || 'Conta desativada'}
                                  className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300 align-middle"
                                >
                                  <Ban className="w-2.5 h-2.5" /> Desativada
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.publicId ? (
                          <span className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 select-all">
                            {user.publicId}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[user.plan] || PLAN_COLORS.FREE}`}>
                          {user.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TRIAL_STATUS_COLORS[user.trialStatus || 'none'] || TRIAL_STATUS_COLORS.none}`}>
                          {TRIAL_STATUS_LABELS[user.trialStatus || 'none'] || 'Sem trial'}
                        </span>
                        {user.trialPlan && user.trialStatus === 'active' && (
                          <span className="text-[10px] text-gray-400 ml-1">({user.trialPlan})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.emailVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" /> Verificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-500">
                            <Clock className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {getPlanPriceBRL(user.plan) > 0 ? (
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            R$ {brl(getPlanPriceBRL(user.plan))}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/20 text-xs font-bold text-blue-700 dark:text-blue-300">
                            {user._count.integrations}
                          </span>
                          {user._count.integrations > 0 && <Zap className="w-3 h-3 text-blue-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {user._count.webhookLogs.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        {user.stripeSubscriptionId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <UserCheck className="w-3 h-3" />
                            Ativa
                          </span>
                        ) : user.plan !== 'FREE' ? (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">Manual</span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.id === meuId ? (
                          <span className="block text-right text-[11px] text-gray-300 dark:text-gray-600">
                            você
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {user.deactivatedAt ? (
                              <button
                                onClick={() => reativar(user)}
                                disabled={acting}
                                title="Reativar esta conta"
                                className="inline-flex items-center gap-1 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" /> Reativar
                              </button>
                            ) : (
                              <button
                                onClick={() => abrirModal('deactivate', user)}
                                disabled={acting}
                                title="Bloquear o acesso sem apagar nada"
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                              >
                                <Ban className="w-3 h-3" /> Desativar
                              </button>
                            )}
                            <button
                              onClick={() => abrirModal('delete', user)}
                              disabled={acting}
                              title="Apagar definitivamente"
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 dark:border-red-900 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" /> Apagar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-gray-400 text-sm">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirmação das ações destrutivas ─────────────────────────────────
          Apagar e desativar não acontecem no clique da linha. Desativar pede um
          motivo (que o próprio usuário lê na tela de login, para não achar que
          a senha quebrou); apagar exige digitar o e-mail exato, porque é
          irreversível e as linhas da tabela ficam coladas umas nas outras. */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={fecharModal}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${modal.kind === 'delete' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-yellow-100 dark:bg-yellow-900/40'}`}>
                  {modal.kind === 'delete'
                    ? <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                    : <Ban className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {modal.kind === 'delete' ? 'Apagar conta definitivamente' : 'Desativar conta'}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {modal.user.name || 'Sem nome'} · {modal.user.email}
                  </p>
                </div>
              </div>
              <button onClick={fecharModal} disabled={acting} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {modal.kind === 'delete' ? (
                <>
                  <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        Isto apaga a conta e tudo ligado a ela — funis, leads, eventos, memórias da SARA,
                        integrações e equipe. <strong>Não há como desfazer.</strong> O histórico financeiro
                        (comissões e vendas de afiliado) é preservado.
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Digite <span className="font-mono text-red-600 dark:text-red-400">{modal.user.email}</span> para confirmar
                    </label>
                    <input
                      autoFocus
                      value={confirmText}
                      onChange={e => setConfirmText(e.target.value)}
                      placeholder={modal.user.email || ''}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    O acesso é bloqueado na hora e as sessões abertas caem. Nenhum dado é apagado —
                    dá para reativar quando quiser.
                  </p>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Motivo <span className="font-normal text-gray-400">(opcional — aparece para o usuário no login)</span>
                    </label>
                    <input
                      autoFocus
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      maxLength={300}
                      placeholder="Ex.: uso indevido da plataforma"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {actionError && (
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-xs text-red-700 dark:text-red-300">{actionError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 p-4">
              <button
                onClick={fecharModal}
                disabled={acting}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              {modal.kind === 'delete' ? (
                <button
                  onClick={() => apagar(modal.user, confirmText)}
                  disabled={acting || confirmText.trim().toLowerCase() !== (modal.user.email || '').toLowerCase()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {acting ? 'Apagando…' : 'Apagar definitivamente'}
                </button>
              ) : (
                <button
                  onClick={() => desativar(modal.user, reason)}
                  disabled={acting}
                  className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-50"
                >
                  {acting ? 'Desativando…' : 'Desativar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
