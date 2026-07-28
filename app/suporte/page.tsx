'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Filter, MessageSquare, Clock, CheckCircle2,
  AlertCircle, ChevronRight, Loader2, X, Tag, Sparkles
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:            { label: 'Novo',              color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  analyzing:      { label: 'Em análise',        color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  investigating:  { label: 'Investigando',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  in_development: { label: 'Em desenvolvimento',color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  waiting_client: { label: 'Aguardando você',   color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  resolved:       { label: 'Resolvido',         color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  closed:         { label: 'Fechado',           color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low:      { label: 'Baixa',   color: 'text-gray-400' },
  medium:   { label: 'Média',   color: 'text-yellow-400' },
  high:     { label: 'Alta',    color: 'text-orange-400' },
  critical: { label: 'Crítica', color: 'text-red-400' },
}

const TYPE_OPTIONS = [
  { value: 'bug',         label: '🐛 Bug' },
  { value: 'suggestion',  label: '💡 Sugestão' },
  { value: 'complaint',   label: '😤 Reclamação' },
  { value: 'question',    label: '❓ Dúvida' },
  { value: 'financial',   label: '💳 Financeiro' },
  { value: 'integration', label: '🔗 Integração' },
  { value: 'other',       label: '📌 Outro' },
]

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Baixa' },
  { value: 'medium',   label: 'Média' },
  { value: 'high',     label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
]

// ── New Ticket Modal ──────────────────────────────────────────────────────────
function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ subject: '', description: '', type: 'question', priority: 'medium' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.subject.trim() || !form.description.trim()) { setError('Preencha todos os campos.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao criar chamado'); return }
      onCreated(data.ticket.id)
    } catch { setError('Erro de conexão') } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-white font-semibold text-lg">Abrir novo chamado</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1.5 font-medium">Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500">
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5 font-medium">Prioridade</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500">
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5 font-medium">Assunto *</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Resumo breve do problema…"
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500" />
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5 font-medium">Descrição detalhada *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={5} placeholder="Descreva o problema com o máximo de detalhes possível…"
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'Enviando…' : 'Abrir chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuportePage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<any[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [q, setQ]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]       = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q)            params.set('q', q)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/support/tickets?${params}`)
      const data = await res.json()
      setTickets(data.tickets ?? [])
      setTotal(data.total ?? 0)
    } catch {} finally { setLoading(false) }
  }, [page, q, statusFilter])

  useEffect(() => { load() }, [load])

  function handleCreated(id: string) {
    setShowNew(false)
    router.push(`/suporte/${id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold">Central de Suporte</h1>
            <p className="text-gray-400 text-sm mt-0.5">Acompanhe seus chamados e fale com a equipe</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition">
            <Plus className="w-4 h-4" /> Novo chamado
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
              placeholder="Pesquisar chamados…"
              className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-blue-500">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: total, icon: MessageSquare, color: 'text-blue-400' },
            { label: 'Abertos', value: tickets.filter(t => !['resolved','closed'].includes(t.status)).length, icon: Clock, color: 'text-yellow-400' },
            { label: 'Resolvidos', value: tickets.filter(t => ['resolved','closed'].includes(t.status)).length, icon: CheckCircle2, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
              <div>
                <p className="text-white font-bold text-xl leading-none">{s.value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Ticket list */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando chamados…
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum chamado encontrado</p>
              <p className="text-sm mt-1">Abra um novo chamado se precisar de ajuda</p>
            </div>
          ) : tickets.map(ticket => {
            const st = STATUS_LABELS[ticket.status] ?? STATUS_LABELS.new
            const pr = PRIORITY_LABELS[ticket.priority] ?? PRIORITY_LABELS.medium
            return (
              <button key={ticket.id} onClick={() => router.push(`/suporte/${ticket.id}`)}
                className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-500 text-xs font-mono">#{ticket.number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                      <span className={`text-xs font-medium ${pr.color}`}>{pr.label}</span>
                    </div>
                    <p className="text-white font-medium mt-1.5 truncate">{ticket.subject}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(ticket.createdAt).toLocaleDateString('pt-BR')} · {ticket._count?.messages ?? 0} mensagens
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition shrink-0 mt-1" />
                </div>
              </button>
            )
          })}
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-3">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition text-sm">
              Anterior
            </button>
            <span className="text-gray-500 text-sm">Página {page}</span>
            <button disabled={tickets.length < 20} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition text-sm">
              Próxima
            </button>
          </div>
        )}
      </div>

      {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
    </div>
  )
}
