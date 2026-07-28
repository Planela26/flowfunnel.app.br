'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Send, Sparkles, Loader2, Lock, User2,
  RefreshCw, StickyNote, ChevronDown, AlertTriangle
} from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'new',            label: 'Novo' },
  { value: 'analyzing',      label: 'Em análise' },
  { value: 'investigating',  label: 'Investigando' },
  { value: 'in_development', label: 'Em desenvolvimento' },
  { value: 'waiting_client', label: 'Aguardando cliente' },
  { value: 'resolved',       label: 'Resolvido' },
  { value: 'closed',         label: 'Fechado' },
]

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Baixa' },
  { value: 'medium',   label: 'Média' },
  { value: 'high',     label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
]

const STATUS_COLOR: Record<string, string> = {
  new:            'bg-blue-500/20 text-blue-400 border-blue-500/30',
  analyzing:      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  investigating:  'bg-orange-500/20 text-orange-400 border-orange-500/30',
  in_development: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  waiting_client: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  resolved:       'bg-green-500/20 text-green-400 border-green-500/30',
  closed:         'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function AdminTicketPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [ticket,   setTicket]   = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [notes,    setNotes]    = useState<any[]>([])
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const [input,    setInput]    = useState('')
  const [noteInput,setNoteInput]= useState('')
  const [tab,      setTab]      = useState<'chat' | 'notes' | 'history'>('chat')
  const [regenAI,  setRegenAI]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const [tRes, aRes] = await Promise.all([
        fetch(`/api/support/tickets/${id}`),
        fetch(`/api/support/tickets/${id}/ai`),
      ])
      const tData = await tRes.json()
      const aData = await aRes.json()
      setTicket(tData.ticket)
      setMessages(tData.ticket?.messages ?? [])
      setNotes(tData.ticket?.notes ?? [])
      setAnalysis(aData.analysis)
    } catch {} finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage() {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    const optimistic = { id: 'tmp', senderType: 'admin', content, createdAt: new Date().toISOString() }
    setMessages(m => [...m, optimistic])
    try {
      await fetch(`/api/support/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      await load()
    } catch {} finally { setSending(false) }
  }

  async function sendNote() {
    if (!noteInput.trim()) return
    await fetch(`/api/support/tickets/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteInput.trim() }),
    })
    setNoteInput('')
    await load()
  }

  async function update(field: string, value: string) {
    await fetch(`/api/admin/support/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    await load()
  }

  async function regenAnalysis() {
    setRegenAI(true)
    try {
      await fetch(`/api/support/tickets/${id}/ai`, { method: 'POST' })
      await load()
    } catch {} finally { setRegenAI(false) }
  }

  // Use Sara.AI suggested reply
  function useSuggestedReply() {
    if (analysis?.suggestedReply) setInput(analysis.suggestedReply)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-500">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando…
    </div>
  )
  if (!ticket) return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">Chamado não encontrado.</div>
  )

  const st = STATUS_COLOR[ticket.status] ?? STATUS_COLOR.new

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => router.push('/admin/suporte')} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-500 text-xs font-mono">#{ticket.number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${st}`}>
              {STATUS_OPTIONS.find(s => s.value === ticket.status)?.label ?? ticket.status}
            </span>
            {ticket.priority === 'critical' && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle className="w-3 h-3" /> Crítico
              </span>
            )}
          </div>
          <p className="text-white font-semibold text-sm mt-0.5 truncate">{ticket.subject}</p>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Main — Chat / Notes / History */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-800 bg-gray-900 shrink-0">
            {([['chat','Conversa'], ['notes','Notas internas'], ['history','Histórico']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition
                  ${tab === v ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Chat */}
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg: any, i: number) => {
                  const isAI    = msg.senderType === 'ai'
                  const isAdmin = msg.senderType === 'admin'
                  return (
                    <div key={msg.id ?? i} className={`flex gap-2.5 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
                        ${isAI ? 'bg-gradient-to-br from-blue-500 to-purple-600' : isAdmin ? 'bg-green-800' : 'bg-gray-700'}`}>
                        {isAI ? <Sparkles className="w-3.5 h-3.5 text-white" /> : <User2 className="w-3.5 h-3.5 text-gray-200" />}
                      </div>
                      <div className={`max-w-[78%] flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                          ${isAdmin ? 'bg-green-800/80 text-white rounded-br-sm' :
                            isAI    ? 'bg-blue-950/60 border border-blue-500/20 text-gray-200 rounded-bl-sm' :
                                      'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm'}`}>
                          {isAI    && <p className="text-blue-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">Sara.AI</p>}
                          {isAdmin && <p className="text-green-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">Equipe FlowSara</p>}
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <p className="text-gray-600 text-[10px] px-1 mt-1">
                          {new Date(msg.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Sara suggested reply banner */}
              {analysis?.suggestedReply && !input && (
                <div className="mx-4 mb-2 p-3 bg-blue-950/40 border border-blue-500/20 rounded-xl flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-300 text-xs font-semibold mb-0.5">Sara.AI sugere uma resposta</p>
                    <p className="text-gray-400 text-xs line-clamp-2">{analysis.suggestedReply}</p>
                  </div>
                  <button onClick={useSuggestedReply}
                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shrink-0">
                    Usar
                  </button>
                </div>
              )}

              <div className="border-t border-gray-800 px-4 py-3 bg-gray-900 shrink-0">
                <div className="flex items-end gap-2 bg-gray-800 rounded-xl border border-gray-700 focus-within:border-blue-500 transition-colors px-3 py-2">
                  <textarea value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    disabled={sending} rows={1}
                    placeholder="Responder cliente… (Enter para enviar)"
                    className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 resize-none outline-none leading-relaxed max-h-32"
                    style={{ minHeight: '1.5rem' }} />
                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="shrink-0 w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 flex items-center justify-center transition">
                    {sending ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {tab === 'notes' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notes.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma nota interna</p>
                </div>
              )}
              {notes.map((n: any) => (
                <div key={n.id} className="bg-yellow-950/30 border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{n.content}</p>
                  <p className="text-gray-600 text-xs mt-2">{new Date(n.createdAt).toLocaleString('pt-BR')}</p>
                </div>
              ))}
              <div className="sticky bottom-0 bg-gray-950 pt-2">
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={3}
                  placeholder="Adicionar nota interna (visível só para admins)…"
                  className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-yellow-500 placeholder-gray-500 resize-none" />
                <button onClick={sendNote} disabled={!noteInput.trim()}
                  className="mt-2 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white text-sm font-medium transition">
                  Salvar nota
                </button>
              </div>
            </div>
          )}

          {/* History */}
          {tab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {ticket.history?.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-12">Sem histórico ainda</p>
              )}
              {(ticket.history ?? []).map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-2 shrink-0" />
                  <div>
                    <span className="text-gray-300 capitalize">{h.action.replace(/_/g, ' ')}</span>
                    {h.from && h.to && <span className="text-gray-500"> · {h.from} → <span className="text-gray-300">{h.to}</span></span>}
                    <p className="text-gray-600 text-xs mt-0.5">{new Date(h.createdAt).toLocaleString('pt-BR')} · {h.actorType}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-64 border-l border-gray-800 bg-gray-900/50 p-4 space-y-5 overflow-y-auto shrink-0">
          {/* Client info */}
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">Cliente</p>
            <p className="text-white font-medium text-sm">{ticket.user?.name ?? '—'}</p>
            <p className="text-gray-400 text-xs">{ticket.user?.email}</p>
            <p className="text-blue-400 text-xs mt-1">{ticket.user?.plan} · {ticket.user?.subscriptionStatus ?? 'sem sub'}</p>
            <p className="text-gray-600 text-xs mt-0.5">Cliente desde {new Date(ticket.user?.createdAt).toLocaleDateString('pt-BR')}</p>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Status</label>
              <select value={ticket.status} onChange={e => update('status', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-1.5">Prioridade</label>
              <select value={ticket.priority} onChange={e => update('priority', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500">
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Sara.AI Analysis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Análise Sara.AI</p>
              <button onClick={regenAnalysis} disabled={regenAI}
                className="text-blue-400 hover:text-blue-300 disabled:opacity-40 transition">
                {regenAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>
            {analysis ? (
              <div className="space-y-2 text-xs">
                <div className="bg-blue-950/30 border border-blue-500/20 rounded-lg p-2.5">
                  <p className="text-blue-300 font-semibold mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Resumo</p>
                  <p className="text-gray-300">{analysis.summary}</p>
                </div>
                {analysis.possibleCause && (
                  <div className="bg-gray-800 rounded-lg p-2.5">
                    <p className="text-gray-500 mb-0.5">Possível causa</p>
                    <p className="text-gray-300">{analysis.possibleCause}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-gray-500 text-[10px]">Bug %</p>
                    <p className="text-white font-bold">{analysis.bugProbability ?? 0}%</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-gray-500 text-[10px]">Complexidade</p>
                    <p className="text-white font-bold capitalize">{analysis.complexity ?? '—'}</p>
                  </div>
                </div>
                {analysis.urgentFlags?.length > 0 && (
                  <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-2.5">
                    <p className="text-red-400 font-semibold mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Alertas</p>
                    {analysis.urgentFlags.map((f: string, i: number) => (
                      <p key={i} className="text-gray-300">• {f}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={regenAnalysis} disabled={regenAI}
                className="w-full py-2 rounded-lg border border-dashed border-gray-700 text-gray-500 text-xs hover:border-blue-500 hover:text-blue-400 transition flex items-center justify-center gap-1">
                {regenAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Gerar análise
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
