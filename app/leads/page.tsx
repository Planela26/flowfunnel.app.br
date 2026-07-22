'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users, Search, Download, RefreshCw, Phone, Mail,
  ShoppingCart, CheckCircle, DollarSign,
  ChevronLeft, ChevronRight, LayoutList, Kanban
} from 'lucide-react'
import LeadKanban from '@/components/LeadKanban'

interface Lead {
  id: string
  phone: string
  name: string
  email: string
  platform: string
  firstSeen: string
  lastSeen: string
  totalEvents: number
  isSale: boolean
  revenue: number
  product: string
  status: 'lead' | 'checkout' | 'cliente'
}

interface Stats {
  total: number
  clientes: number
  checkout: number
  leads: number
  revenue: number
}

// Plataformas de ORIGEM (boca do funil) — onde o lead realmente entrou
const PLATFORM_LABELS: Record<string, string> = {
  META_ADS: 'Meta Ads',
  GOOGLE_ADS: 'Google Ads',
  TIKTOK_ADS: 'TikTok Ads',
  DIRECT: 'Direto / Orgânico',
}

const PLATFORM_COLORS: Record<string, string> = {
  META_ADS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  GOOGLE_ADS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  TIKTOK_ADS: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  DIRECT: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  lead: { label: 'Lead', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', icon: Users },
  checkout: { label: 'Checkout', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', icon: ShoppingCart },
  cliente: { label: 'Cliente', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: CheckCircle },
}

export default function LeadsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('all')
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
  }, [status])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        days: String(days),
        platform,
        search,
        page: String(page),
      })
      const res = await fetch(`/api/leads?${params}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setStats(data.stats || null)
      setTotal(data.total || 0)
      setTotalPages(data.pages || 1)
    } catch {}
    setLoading(false)
  }, [days, platform, search, page])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const exportCSV = () => {
    const headers = ['Nome', 'Telefone', 'Email', 'Plataforma', 'Status', 'Produto', 'Receita', 'Eventos', 'Primeiro Contato', 'Último Contato']
    const rows = leads.map(l => [
      l.name || '-',
      l.phone || '-',
      l.email || '-',
      PLATFORM_LABELS[l.platform] || l.platform,
      STATUS_CONFIG[l.status]?.label || l.status,
      l.product || '-',
      l.revenue > 0 ? `R$ ${l.revenue.toFixed(2)}` : '-',
      l.totalEvents,
      new Date(l.firstSeen).toLocaleDateString('pt-BR'),
      new Date(l.lastSeen).toLocaleDateString('pt-BR'),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const formatDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (status === 'loading') return null

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <div className="max-w-7xl w-full mx-auto px-4 py-8 flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Leads & Contatos
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Todos os contatos que interagiram com seu funil
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <LayoutList className="w-4 h-4" />
                Lista
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'kanban' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                <Kanban className="w-4 h-4" />
                CRM
              </button>
            </div>
            {view === 'list' && (
              <>
                <button
                  onClick={fetchLeads}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total de Leads', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Clientes', value: stats.clientes, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
              { label: 'Checkout', value: stats.checkout, icon: ShoppingCart, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
              {
                label: 'Receita Total',
                value: `R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                icon: DollarSign,
                color: 'text-purple-600',
                bg: 'bg-purple-50 dark:bg-purple-900/20',
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
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
        )}

        {/* Conversion rate mini */}
        {stats && stats.total > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 mb-6 flex flex-wrap gap-6 items-center">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Taxa de conversão</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(100, ((stats.checkout + stats.clientes) / stats.total) * 100)}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Lead → Checkout: {stats.total > 0 ? (((stats.checkout + stats.clientes) / stats.total) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, (stats.clientes / stats.total) * 100)}%` }} />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Lead → Cliente: {stats.total > 0 ? ((stats.clientes / stats.total) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        )}

        {/* CRM Kanban view */}
        {view === 'kanban' && <LeadKanban />}

        {/* List view — Filters + Table */}
        {view === 'list' && <>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
            />
          </div>
          <select
            value={platform}
            onChange={e => { setPlatform(e.target.value); setPage(1) }}
            className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">Todas as origens</option>
            <option value="META_ADS">Meta Ads</option>
            <option value="GOOGLE_ADS">Google Ads</option>
            <option value="TIKTOK_ADS">TikTok Ads</option>
            <option value="DIRECT">Direto / Orgânico</option>
          </select>
          <select
            value={days}
            onChange={e => { setDays(Number(e.target.value)); setPage(1) }}
            className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum lead encontrado</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                Configure seus webhooks para começar a capturar leads automaticamente.
              </p>
            </div>
          ) : (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contato</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Plataforma</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Produto</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Receita</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Eventos</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Último contato</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const statusCfg = STATUS_CONFIG[lead.status]
                    const StatusIcon = statusCfg.icon
                    return (
                      <tr key={lead.id} className={`border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40 dark:bg-gray-800/10'}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {lead.name || <span className="text-gray-400 dark:text-gray-500 italic">Sem nome</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {lead.phone && (
                              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                <Phone className="w-3 h-3" />
                                {lead.phone}
                              </span>
                            )}
                            {lead.email && (
                              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                <Mail className="w-3 h-3" />
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[lead.platform] || 'bg-gray-100 text-gray-600'}`}>
                            {PLATFORM_LABELS[lead.platform] || lead.platform}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[150px] truncate">
                          {lead.product || <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {lead.revenue > 0 ? (
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              R$ {lead.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">
                            {lead.totalEvents}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {formatDate(lead.lastSeen)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Mostrando {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} de {total} leads
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        </>}
      </div>
    </div>
  )
}
