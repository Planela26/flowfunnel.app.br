'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ticket, AlertTriangle, Clock, CheckCircle2, Search,
  ChevronRight, Loader2, RefreshCw
} from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:            { label: 'Novo',               color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  analyzing:      { label: 'Em análise',         color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  investigating:  { label: 'Investigando',       color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  in_development: { label: 'Em desenvolvimento', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  waiting_client: { label: 'Aguardando cliente', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  resolved:       { label: 'Resolvido',          color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  closed:         { label: 'Fechado',            color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

const PRIORITY_DOT: Record<string, string> = {
  low:      'bg-gray-400',
  medium:   'bg-yellow-400',
  high:     'bg-orange-400',
  critical: 'bg-red-500',
}

const PLAN_COLOR: Record<string, string> = {
  FREE:       'text-gray-400',
  PRO:        'text-blue-400',
  ENTERPRISE: 'text-purple-400',
}

export default function AdminSuportePage() {
  const router = useRouter()
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [q,       setQ]       = useState('')
  const [status,  setStatus]  = useState('')
  const [priority,setPriority]= useState('')
  const [page,    setPage]    = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q)        params.set('q', q)
      if (status)   params.set('status', status)
      if (priority) params.set('priority', priority)
      const res  = await fetch(`/api/admin/support?${params}`)
      const json = await res.json()
      setData(json)
    } catch {} finally { setLoading(false) }
  }, [page, q, status, priority])

  useEffect(() => { load() }, [load])

  const stats = data?.stats ?? {}
  const tickets: any[] = data?.tickets ?? []

  const statCards = [
    { label: 'Total abertos',  value: (stats.byStatus?.new ?? 0) + (stats.byStatus?.analyzing ?? 0) + (stats.byStatus?.investigating ?? 0) + (stats.byStatus?.in_development ?? 0) + (stats.byStatus?.waiting_client ?? 0), icon: Ticket, color: 'text-blue-400' },
    { label: 'Críticos',       value: stats.byPriority?.critical ?? 0,  icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Resolvidos',     value: (stats.byStatus?.resolved ?? 0) + (stats.byStatus?.closed ?? 0), icon: CheckCircle2,  color: 'text-green-400' },
    { label: 'Resp. média (h)',value: stats.avgResponseHours ?? 0,       icon: Clock,         color: 'text-yellow-400' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Central de Suporte</h1>
          <p className="text-gray-400 text-sm mt-0.5">Gerenciamento de chamados · Painel Admin</p>
        </div>
        <button onClick={() => load()} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
            <div>
              <p className="text-white font-bold text-xl leading-none">{s.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* By status mini-grid */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
          <button key={key} onClick={() => { setStatus(status === key ? '' : key); setPage(1) }}
            className={`rounded-lg p-2 border text-xs font-medium transition text-center ${status === key ? color : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'}`}>
            <p className="text-base font-bold">{stats.byStatus?.[key] ?? 0}</p>
            <p className="mt-0.5 truncate">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
            placeholder="Buscar por assunto, cliente ou email…"
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500" />
        </div>
        <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-blue-500">
          <option value="">Todas as prioridades</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Ticket className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>Nenhum chamado encontrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-gray-500 text-xs uppercase tracking-wide">
                {['#', 'Cliente / Plano', 'Assunto', 'Prioridade', 'Status', 'Msgs', 'Data', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tickets.map((t: any) => {
                const st = STATUS_LABELS[t.status] ?? STATUS_LABELS.new
                return (
                  <tr key={t.id} onClick={() => router.push(`/admin/suporte/${t.id}`)}
                    className="hover:bg-gray-800/60 cursor-pointer transition group">
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">#{t.number}</td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium text-sm">{t.user?.name ?? '—'}</p>
                      <p className={`text-xs ${PLAN_COLOR[t.user?.plan] ?? 'text-gray-400'}`}>{t.user?.plan}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-[220px] truncate">{t.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-gray-400'} mr-1.5`} />
                      <span className="text-gray-400 capitalize text-xs">{t.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t._count?.messages ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(data?.total ?? 0) > 25 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition text-sm">Anterior</button>
          <span className="text-gray-500 text-sm">Página {page} de {data?.pages}</span>
          <button disabled={tickets.length < 25} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition text-sm">Próxima</button>
        </div>
      )}
    </div>
  )
}
