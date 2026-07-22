'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  Eye,
  ShieldCheck,
  ArrowRight,
  Mail,
  Lock,
  XCircle,
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Zap,
  DollarSign,
  Filter as FunnelIcon,
  Activity as ActivityIcon,
  BarChart as BarChartIcon,
  Megaphone,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface InviteData {
  member: {
    id: string
    email: string
    name: string | null
    role: string
    status: string
    ownerId: string
  }
  owner: {
    id: string
    name: string | null
    email: string
    plan: string
  }
}

interface DashboardData {
  overview: {
    totalEvents: number
    totalLeads: number
    totalFunnels: number
    activeFunnels: number
    eventsToday: number
    events7d: number
    events30d: number
    leadsToday: number
    leads7d: number
    leads30d: number
  }
  timeline: Array<{ date: string; eventos: number }>
  leadStatus: Array<{ status: string; count: number }>
  campaigns: Array<{ id: string; name: string; platform: string; isActive: boolean; createdAt: string; spend: number }>
  funnels: Array<{ id: string; name: string; isActive: boolean; events: number }>
  goals: Array<{ id: string; title: string; targetValue: number; currentValue: number; isActive: boolean; progress: number }>
  owner: { name: string | null; email: string }
  member: { id: string; email: string; name: string | null; role: string }
}

function InvitePageInner() {
  const params = useSearchParams()
  const token = params.get('token')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Link de convite invalido. Nenhum token encontrado.')
      return
    }

    fetch(`/api/team/accept?token=${token}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) {
          throw new Error(body.error || 'Erro ao validar convite')
        }
        setInviteData(body)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [token])

  const acceptInvite = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/team/accept?token=${token}`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro')
      setAccepted(true)

      const dashRes = await fetch(`/api/team/viewer-dashboard?token=${token}&ownerId=${inviteData?.owner.id}`)
      const dashData = await dashRes.json()
      if (dashRes.ok) {
        setDashboard(dashData)
      }
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-white mx-auto mb-4" />
          <p className="text-blue-200 font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full text-center p-10">
          <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30">
            <XCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-3">Convite invalido</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold">
            <ArrowRight className="w-4 h-4" />
            Ir para a pagina inicial
          </Link>
        </div>
      </div>
    )
  }

  if (!inviteData) return null
  const { member, owner } = inviteData
  const isViewer = member.role === 'VIEWER'

  // Tela de convite (antes de aceitar)
  if (!accepted) {
    if (isViewer) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center px-4 py-12">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full text-center overflow-hidden">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-10">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
                <Eye className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 mb-3">
                Voce foi convidado para visualizar
              </h1>
              <p className="text-gray-600 text-base leading-relaxed mb-4">
                <strong className="text-gray-900">{owner.name || owner.email}</strong> convidou voce para
                acessar o painel do FlowFunnel como <strong>Visualizador</strong>.
              </p>
              <div className="flex items-center justify-center gap-2 text-blue-700 bg-blue-100 rounded-xl px-4 py-3 text-sm font-medium">
                <ShieldCheck className="w-4 h-4" />
                Acesso somente leitura — voce pode ver os dados, mas nao editar.
              </div>
            </div>
            <div className="p-6 bg-gray-50 space-y-3">
              <button
                onClick={acceptInvite}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {loading ? 'Abrindo...' : 'Ver painel do funil'}
              </button>
              <p className="text-xs text-gray-400">
                Nao precisa de login. Clique para visualizar os dados em tempo real.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full text-center overflow-hidden">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-10">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-3">
              Voce foi convidado para o time
            </h1>
            <p className="text-gray-600 text-base leading-relaxed mb-4">
              <strong className="text-gray-900">{owner.name || owner.email}</strong> convidou voce para
              o time do FlowFunnel com permissao de <strong>{member.role === 'EDITOR' ? 'Editor' : 'Admin'}</strong>.
            </p>
            <div className="flex items-center justify-center gap-2 text-amber-700 bg-amber-50 rounded-xl px-4 py-3 text-sm font-medium">
              <Lock className="w-4 h-4" />
              Voce precisa fazer login para aceitar este convite.
            </div>
          </div>
          <div className="p-6 bg-gray-50 space-y-3">
            <Link
              href={`/login?callbackUrl=/invite?token=${token}`}
              className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl transition"
            >
              <Mail className="w-4 h-4" />
              Entrar com minha conta
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard do visualizador
  if (!dashboard) return null
  const ov = dashboard.overview

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0c1426] border-b border-white/5 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight leading-none">FlowFunnel</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-200 text-xs font-bold rounded-full border border-blue-500/30">
              <Eye className="w-3 h-3" />
              Modo Visualizador
            </span>
            <span className="text-blue-300 text-sm hidden sm:inline">
              {owner.name || owner.email}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Visao Geral do Funil
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Visualizando dados de {owner.name || owner.email} — modo somente leitura
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            icon={Zap}
            label="Eventos Totais"
            value={ov.totalEvents}
            sublabel={`${ov.events7d} esta semana`}
            color="blue"
          />
          <KpiCard
            icon={Users}
            label="Leads Totais"
            value={ov.totalLeads}
            sublabel={`${ov.leads7d} esta semana`}
            color="purple"
          />
          <KpiCard
            icon={Target}
            label="Funis Ativos"
            value={ov.activeFunnels}
            sublabel={`${ov.totalFunnels} total`}
            color="emerald"
          />
          <KpiCard
            icon={DollarSign}
            label="Eventos (30d)"
            value={ov.events30d}
            sublabel={`${ov.leads30d} leads (30d)`}
            color="amber"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Timeline chart */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <ActivityIcon className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Atividade nos ultimos 7 dias</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dashboard.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line type="monotone" dataKey="eventos" name="Eventos" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Lead Status */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChartIcon className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Status dos Leads</h3>
            </div>
            {dashboard.leadStatus.length > 0 ? (
              <div className="space-y-3">
                {dashboard.leadStatus.map((s) => (
                  <div key={s.status} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{s.status}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{s.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${ov.totalLeads > 0 ? (s.count / ov.totalLeads) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                Nenhum status cadastrado
              </div>
            )}
          </div>
        </div>

        {/* Funnels + Campaigns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Funis */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FunnelIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Funis ({ov.totalFunnels})</h3>
            </div>
            {dashboard.funnels.length > 0 ? (
              <div className="space-y-3">
                {dashboard.funnels.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${f.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{f.name}</p>
                        <p className="text-xs text-gray-500">{f.events} eventos (7d)</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      f.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {f.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Nenhum funil configurado
              </div>
            )}
          </div>

          {/* Campanhas */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Campanhas</h3>
            </div>
            {dashboard.campaigns.length > 0 ? (
              <div className="space-y-3">
                {dashboard.campaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        c.platform === 'META_ADS' ? 'bg-blue-100 text-blue-600' :
                        c.platform === 'GOOGLE_ADS' ? 'bg-red-100 text-red-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        <Megaphone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.platform}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {c.isActive ? 'Ativa' : 'Pausada'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Nenhuma campanha configurada
              </div>
            )}
          </div>
        </div>

        {/* Goals + Period Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Goals */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Metas</h3>
            </div>
            {dashboard.goals.length > 0 ? (
              <div className="space-y-4">
                {dashboard.goals.map((g) => (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{g.title}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{g.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${g.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(g.progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {g.currentValue} / {g.targetValue}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">Nenhuma meta cadastrada</div>
            )}
          </div>

          {/* Period comparison */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Comparativo de Periodos</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <PeriodCard
                period="Hoje"
                events={ov.eventsToday}
                leads={ov.leadsToday}
                color="blue"
              />
              <PeriodCard
                period="Ultimos 7 dias"
                events={ov.events7d}
                leads={ov.leads7d}
                color="purple"
                highlight
              />
              <PeriodCard
                period="Ultimos 30 dias"
                events={ov.events30d}
                leads={ov.leads30d}
                color="emerald"
              />
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Modo Visualizador</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Voce esta visualizando os dados do funil em modo somente leitura.
                Para editar campanhas, metas ou configurar integracoes, solicite permissao de Editor ao proprietario.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: any
  label: string
  value: string | number
  sublabel: string
  color: string
}) {
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', icon: 'text-blue-600' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', icon: 'text-purple-600' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', icon: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-600' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
      <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sublabel}</p>
    </div>
  )
}

function PeriodCard({
  period,
  events,
  leads,
  color,
  highlight,
}: {
  period: string
  events: number
  leads: number
  color: string
  highlight?: boolean
}) {
  const colorMap: Record<string, { border: string; bg: string }> = {
    blue: { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    purple: { border: 'border-purple-200 dark:border-purple-800', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    emerald: { border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className={`rounded-xl border ${c.border} ${highlight ? c.bg : 'bg-white dark:bg-gray-800'} p-4`}>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{period}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Eventos</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{events}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Leads</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{leads}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Taxa</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {events > 0 ? ((leads / events) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      }
    >
      <InvitePageInner />
    </Suspense>
  )
}
