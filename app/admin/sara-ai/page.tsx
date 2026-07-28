'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles, Zap, DollarSign, Clock, TrendingUp, RefreshCw,
  Loader2, BarChart2, CheckCircle2, BookOpen, Plus, Pencil, Trash2, Eye, EyeOff
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'

const CATEGORY_COLORS: Record<string, string> = {
  bug:         '#ef4444',
  billing:     '#f97316',
  integration: '#8b5cf6',
  ux:          '#06b6d4',
  onboarding:  '#22c55e',
  performance: '#f59e0b',
  other:       '#6b7280',
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-white font-bold text-2xl leading-none">{value}</p>
        <p className="text-gray-400 text-sm mt-1">{label}</p>
        {sub && <p className="text-gray-600 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── KB Article Form ───────────────────────────────────────────────────────────
function ArticleModal({ article, onClose, onSaved }: { article?: any; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!article
  const [form, setForm] = useState({
    title:     article?.title     ?? '',
    content:   article?.content   ?? '',
    category:  article?.category  ?? 'general',
    tags:      article?.tags      ? JSON.parse(article.tags).join(', ') : '',
    version:   article?.version   ?? '1.0',
    published: article?.published ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function save() {
    if (!form.title.trim() || !form.content.trim()) { setError('Título e conteúdo são obrigatórios'); return }
    setSaving(true)
    try {
      const tags = form.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      const url  = isEdit ? `/api/admin/knowledge/${article.id}` : '/api/admin/knowledge'
      const method = isEdit ? 'PATCH' : 'POST'
      const res  = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      onSaved()
    } catch { setError('Erro de conexão') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h3 className="text-white font-semibold">{isEdit ? 'Editar artigo' : 'Novo artigo'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500">
                {['general','billing','integration','bug','ux','onboarding','performance','whatsapp','meta','stripe','mercadopago'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Versão</label>
              <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="1.0"
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Título *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Título do artigo…"
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Tags (separadas por vírgula)</label>
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="webhook, stripe, erro, pagamento…"
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Conteúdo (Markdown) *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={10} placeholder="# Título&#10;&#10;Descreva o problema e a solução…"
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500 resize-none font-mono" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
              className="w-4 h-4 accent-blue-500" />
            <span className="text-gray-300 text-sm">Publicar (Sara.AI usará este artigo)</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition text-sm">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Salvando…' : 'Salvar artigo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SaraAIDashboardPage() {
  const [tab,      setTab]      = useState<'dashboard' | 'kb'>('dashboard')
  const [data,     setData]     = useState<any>(null)
  const [articles, setArticles] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<{ open: boolean; article?: any }>({ open: false })

  const loadDash = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/ai-logs?days=30')
      const json = await res.json()
      setData(json)
    } catch {} finally { setLoading(false) }
  }, [])

  const loadKB = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/knowledge')
      const json = await res.json()
      setArticles(json.articles ?? [])
    } catch {}
  }, [])

  useEffect(() => { loadDash(); loadKB() }, [loadDash, loadKB])

  async function deleteArticle(id: string) {
    if (!confirm('Excluir este artigo?')) return
    await fetch(`/api/admin/knowledge/${id}`, { method: 'DELETE' })
    loadKB()
  }

  async function togglePublish(article: any) {
    await fetch(`/api/admin/knowledge/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !article.published }),
    })
    loadKB()
  }

  const s = data?.summary ?? {}

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold">Sara.AI — Dashboard</h1>
            <p className="text-gray-400 text-sm">Monitoramento de IA e Base de Conhecimento</p>
          </div>
        </div>
        <button onClick={() => { loadDash(); loadKB() }} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {([['dashboard', 'Dashboard IA'], ['kb', 'Base de Conhecimento']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition
              ${tab === v ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Dashboard tab ── */}
      {tab === 'dashboard' && (
        loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Zap}          label="Análises realizadas (30d)" value={s.totalCalls ?? 0}    color="bg-blue-500/20 text-blue-400" />
              <StatCard icon={DollarSign}   label="Custo estimado (USD)"      value={`$${(s.totalCostUsd ?? 0).toFixed(4)}`} sub="gpt-4o-mini" color="bg-green-500/20 text-green-400" />
              <StatCard icon={CheckCircle2} label="Taxa de aceitação"         value={s.acceptanceRate != null ? `${s.acceptanceRate}%` : '—'} sub="sugestões usadas pelo admin" color="bg-purple-500/20 text-purple-400" />
              <StatCard icon={Clock}        label="Latência média"            value={`${Math.round((s.avgDurationMs ?? 0) / 100) / 10}s`} sub="por análise" color="bg-yellow-500/20 text-yellow-400" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Daily activity */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-white font-semibold mb-4">Atividade diária (últimos 30 dias)</p>
                {(data?.daily?.length ?? 0) === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-8">Sem dados ainda</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#9ca3af' }} />
                      <Line dataKey="count" name="Análises" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* By category */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-white font-semibold mb-4">Categorias detectadas</p>
                {(data?.byCategory?.length ?? 0) === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-8">Sem dados ainda</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="category" tick={{ fill: '#6b7280', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                      <Bar dataKey="count" name="Tickets" radius={[4,4,0,0]}>
                        {(data.byCategory ?? []).map((entry: any, i: number) => (
                          <Cell key={i} fill={CATEGORY_COLORS[entry.category] ?? '#6b7280'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Recent logs */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <p className="text-white font-semibold">Últimas chamadas de IA</p>
              </div>
              <div className="divide-y divide-gray-800">
                {(data?.recentLogs ?? []).slice(0, 15).map((log: any) => (
                  <div key={log.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                        {log.action.replace('_', ' ')}
                      </span>
                      <span className="text-gray-400">{log.totalTokens} tokens</span>
                      {log.category && <span className="text-gray-600 text-xs">{log.category}</span>}
                    </div>
                    <div className="flex items-center gap-4 text-gray-600 text-xs">
                      <span>${(log.costUsd ?? 0).toFixed(5)}</span>
                      <span>{Math.round(log.durationMs / 100) / 10}s</span>
                      <span>{new Date(log.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                ))}
                {(data?.recentLogs ?? []).length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-600 text-sm">Nenhuma chamada ainda</div>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Knowledge Base tab ── */}
      {tab === 'kb' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">{articles.length} artigos · Sara.AI consulta automaticamente os publicados</p>
            <button onClick={() => setModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition">
              <Plus className="w-4 h-4" /> Novo artigo
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {articles.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum artigo ainda</p>
                <p className="text-xs mt-1">Adicione artigos para enriquecer o contexto da Sara.AI</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr className="text-gray-500 text-xs uppercase tracking-wide">
                    {['Título', 'Categoria', 'Versão', 'Status', 'Atualizado', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {articles.map(a => (
                    <tr key={a.id} className="hover:bg-gray-800/60 transition">
                      <td className="px-4 py-3 text-gray-200 font-medium">{a.title}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: (CATEGORY_COLORS[a.category] ?? '#6b7280') + '30', color: CATEGORY_COLORS[a.category] ?? '#6b7280' }}>
                          {a.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.version ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${a.published ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-700 text-gray-500 border-gray-600'}`}>
                          {a.published ? 'Publicado' : 'Rascunho'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{new Date(a.updatedAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => togglePublish(a)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition" title={a.published ? 'Despublicar' : 'Publicar'}>
                            {a.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setModal({ open: true, article: a })} className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-gray-700 transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteArticle(a.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-700 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {modal.open && (
        <ArticleModal
          article={modal.article}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); loadKB() }}
        />
      )}
    </div>
  )
}
