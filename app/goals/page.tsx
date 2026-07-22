'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Target, Plus, Trash2, CheckCircle, Clock, TrendingUp,
  Loader2, X, Calendar, BarChart2, DollarSign, Users, MessageCircle
} from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'

interface Goal {
  id: string
  title: string
  description: string | null
  targetValue: number
  currentValue: number
  metric: string
  platform: string | null
  endDate: string
  isCompleted: boolean
  isActive: boolean
  createdAt: string
}

const METRIC_OPTIONS = [
  { value: 'sales', label: 'Vendas', icon: DollarSign, color: 'text-green-600' },
  { value: 'revenue', label: 'Receita (R$)', icon: DollarSign, color: 'text-emerald-600' },
  { value: 'leads', label: 'Leads captados', icon: Users, color: 'text-blue-600' },
  { value: 'conversions', label: 'Conversões', icon: TrendingUp, color: 'text-purple-600' },
  { value: 'clicks', label: 'Cliques no anúncio', icon: BarChart2, color: 'text-orange-600' },
  { value: 'messages', label: 'Conversas WhatsApp', icon: MessageCircle, color: 'text-teal-600' },
]

const PLATFORM_OPTIONS = [
  { value: 'ALL', label: 'Todas as plataformas' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'META_ADS', label: 'Facebook Ads' },
  { value: 'HOTMART', label: 'Hotmart' },
  { value: 'KIWIFY', label: 'Kiwify' },
]

function metricLabel(metric: string) {
  return METRIC_OPTIONS.find(m => m.value === metric)?.label ?? metric
}

function MetricIcon({ metric }: { metric: string }) {
  const m = METRIC_OPTIONS.find(m => m.value === metric)
  if (!m) return <Target className="w-4 h-4 text-gray-400" />
  const Icon = m.icon
  return <Icon className={`w-4 h-4 ${m.color}`} />
}

function daysLeft(endDate: string): number {
  const end = new Date(endDate)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default function GoalsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    targetValue: '',
    metric: 'sales',
    platform: 'ALL',
    endDate: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/goals')
      .then(r => r.json())
      .then(d => setGoals(d.goals || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          targetValue: parseFloat(form.targetValue),
        }),
      })
      const data = await res.json()
      if (data.goal) {
        setGoals(prev => [data.goal, ...prev])
        setShowForm(false)
        setForm({ title: '', description: '', targetValue: '', metric: 'sales', platform: 'ALL', endDate: '' })
      }
    } catch {}
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch(`/api/goals/${id}`, { method: 'DELETE' })
      setGoals(prev => prev.filter(g => g.id !== id))
    } catch {}
    setDeleting(null)
  }

  const active = goals.filter(g => g.isActive && !g.isCompleted)
  const completed = goals.filter(g => g.isCompleted)

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
        <DashboardSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <DashboardSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto lg:pl-72">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" />
                Metas e Objetivos
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Defina metas mensais para seu funil e acompanhe o progresso.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nova Meta
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-2xl font-black text-gray-900 dark:text-white">{active.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Metas Ativas</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-2xl font-black text-green-600 dark:text-green-400">{completed.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Concluídas</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center col-span-2 sm:col-span-1">
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{goals.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total de Metas</p>
            </div>
          </div>

          {/* Form Modal */}
          {showForm && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    Nova Meta
                  </h2>
                  <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Título da meta *</label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Ex: 50 vendas em março"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Métrica *</label>
                      <select
                        required
                        value={form.metric}
                        onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {METRIC_OPTIONS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Valor alvo *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="any"
                        value={form.targetValue}
                        onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                        placeholder="Ex: 50"
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Plataforma</label>
                      <select
                        value={form.platform}
                        onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {PLATFORM_OPTIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Data limite *</label>
                      <input
                        type="date"
                        required
                        value={form.endDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Descrição (opcional)</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Descreva sua estratégia para atingir essa meta..."
                      rows={2}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Criar Meta
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Metas ativas */}
          {active.length === 0 && completed.length === 0 ? (
            <div className="text-center py-20">
              <Target className="w-14 h-14 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Nenhuma meta criada ainda</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Defina objetivos claros para crescer seu funil.</p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
                Criar primeira meta
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {active.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Metas Ativas ({active.length})
                  </h2>
                  <div className="space-y-3">
                    {active.map(goal => {
                      const progress = goal.targetValue > 0
                        ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
                        : 0
                      const days = daysLeft(goal.endDate)
                      const isUrgent = days <= 7 && days > 0
                      const isOverdue = days <= 0

                      return (
                        <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                <MetricIcon metric={goal.metric} />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">{goal.title}</p>
                                {goal.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{goal.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                    <BarChart2 className="w-3 h-3" />
                                    {metricLabel(goal.metric)}
                                  </span>
                                  <span className={`text-xs flex items-center gap-1 font-medium ${
                                    isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'
                                  }`}>
                                    <Calendar className="w-3 h-3" />
                                    {isOverdue ? 'Expirada' : isUrgent ? `${days}d restantes` : `${days} dias`}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDelete(goal.id)}
                              disabled={deleting === goal.id}
                              className="text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition flex-shrink-0"
                            >
                              {deleting === goal.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>

                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progress >= 100 ? 'bg-green-500'
                                  : progress >= 80 ? 'bg-blue-500'
                                  : progress >= 50 ? 'bg-indigo-500'
                                  : 'bg-gray-400'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[40px] text-right">
                              {progress}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              {goal.currentValue.toLocaleString('pt-BR')} / {goal.targetValue.toLocaleString('pt-BR')} {metricLabel(goal.metric).toLowerCase()}
                            </span>
                            <span className="font-medium">
                              Faltam {Math.max(0, goal.targetValue - goal.currentValue).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {completed.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Concluídas ({completed.length})
                  </h2>
                  <div className="space-y-3">
                    {completed.map(goal => (
                      <div key={goal.id} className="bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800 p-4 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{goal.title}</p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Meta de {goal.targetValue.toLocaleString('pt-BR')} {metricLabel(goal.metric).toLowerCase()} atingida
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          disabled={deleting === goal.id}
                          className="text-gray-300 hover:text-red-500 transition"
                        >
                          {deleting === goal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
