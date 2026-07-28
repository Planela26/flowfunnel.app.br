'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Send, Sparkles, Loader2, ChevronDown, Lock,
  AlertTriangle, CheckCircle2, Clock, User2, Bot, RefreshCw
} from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:            { label: 'Novo',               color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  analyzing:      { label: 'Em análise',         color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  investigating:  { label: 'Investigando',       color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  in_development: { label: 'Em desenvolvimento', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  waiting_client: { label: 'Aguardando você',    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  resolved:       { label: 'Resolvido',          color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  closed:         { label: 'Fechado',            color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

function AISummaryCard({ analysis }: { analysis: any }) {
  if (!analysis) return null
  return (
    <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-400" />
        <span className="text-blue-300 font-semibold text-sm">Análise Sara.AI</span>
      </div>
      {analysis.summary && <p className="text-gray-300 text-sm">{analysis.summary}</p>}
      {analysis.possibleCause && (
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Possível causa</p>
          <p className="text-gray-300 text-sm">{analysis.possibleCause}</p>
        </div>
      )}
      {analysis.suggestions?.length > 0 && (
        <div>
          <p className="text-gray-500 text-xs mb-1">Sugestões</p>
          <ul className="space-y-1">
            {analysis.suggestions.map((s: string, i: number) => (
              <li key={i} className="text-gray-300 text-sm flex gap-1.5">
                <span className="text-blue-400 shrink-0">•</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg, isAdmin }: { msg: any; isAdmin: boolean }) {
  const isUser  = msg.senderType === 'user'
  const isAI    = msg.senderType === 'ai'
  const isMine  = isUser && !isAdmin

  return (
    <div className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
        ${isAI   ? 'bg-gradient-to-br from-blue-500 to-purple-600' :
          isUser  ? 'bg-gray-700' : 'bg-green-700'}`}>
        {isAI   ? <Sparkles className="w-3.5 h-3.5 text-white" /> :
         isUser  ? <User2 className="w-3.5 h-3.5 text-gray-300" /> :
                   <User2 className="w-3.5 h-3.5 text-green-200" />}
      </div>

      <div className={`max-w-[78%] space-y-1 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${isMine
            ? 'bg-blue-600 text-white rounded-br-sm'
            : isAI
            ? 'bg-blue-950/60 border border-blue-500/20 text-gray-200 rounded-bl-sm'
            : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm'}`}>
          {isAI && <p className="text-blue-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">Sara.AI</p>}
          {!isAI && !isUser && <p className="text-green-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">Equipe FlowSara</p>}
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
        <p className="text-gray-600 text-[10px] px-1">
          {new Date(msg.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  )
}

export default function TicketDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const { data: session } = useSession()
  const isAdmin   = (session?.user as any)?.role === 'ADMIN'

  const [ticket,   setTicket]   = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [analysis, setAnalysis] = useState<any>(null)
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
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
    const optimistic = { id: 'tmp', senderType: isAdmin ? 'admin' : 'user', content, createdAt: new Date().toISOString() }
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

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  async function changeStatus(status: string) {
    await fetch(`/api/support/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-500">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando chamado…
    </div>
  )
  if (!ticket) return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">Chamado não encontrado.</div>
  )

  const st = STATUS_LABELS[ticket.status] ?? STATUS_LABELS.new
  const isClosed = ticket.status === 'closed'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/suporte')} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs font-mono">#{ticket.number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
            </div>
            <p className="text-white font-semibold text-sm mt-0.5 line-clamp-1">{ticket.subject}</p>
          </div>
        </div>
        {!isAdmin && ticket.status === 'waiting_client' && (
          <button onClick={() => changeStatus('analyzing')}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition">
            Respondido
          </button>
        )}
        {!isAdmin && ['resolved'].includes(ticket.status) && (
          <button onClick={() => changeStatus('closed')}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white transition">
            Fechar chamado
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-5xl mx-auto w-full">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* AI analysis */}
            {analysis && <AISummaryCard analysis={analysis} />}

            {/* Messages */}
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id ?? i} msg={msg} isAdmin={isAdmin} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!isClosed ? (
            <div className="border-t border-gray-800 px-4 py-3 bg-gray-900 shrink-0">
              <div className="flex items-end gap-2 bg-gray-800 rounded-xl border border-gray-700 focus-within:border-blue-500 transition-colors px-3 py-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={sending}
                  rows={1}
                  placeholder="Escreva uma mensagem… (Enter para enviar)"
                  className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 resize-none outline-none leading-relaxed max-h-32"
                  style={{ minHeight: '1.5rem' }}
                />
                <button onClick={sendMessage} disabled={!input.trim() || sending}
                  className="shrink-0 w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 flex items-center justify-center transition">
                  {sending ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-800 px-4 py-3 bg-gray-900 shrink-0 flex items-center gap-2 text-gray-500 text-sm">
              <Lock className="w-4 h-4" /> Chamado fechado
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="md:w-64 border-t md:border-t-0 md:border-l border-gray-800 bg-gray-900/50 p-4 space-y-4 shrink-0">
          <div>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">Detalhes</p>
            <dl className="space-y-2 text-sm">
              {[
                ['Tipo', ticket.type],
                ['Prioridade', ticket.priority],
                ['Criado', new Date(ticket.createdAt).toLocaleDateString('pt-BR')],
                ['Atualizado', new Date(ticket.updatedAt).toLocaleDateString('pt-BR')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-gray-300 capitalize">{v as string}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* History */}
          {ticket.history?.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">Histórico</p>
              <div className="space-y-1.5">
                {ticket.history.slice(-5).map((h: any) => (
                  <div key={h.id} className="text-xs text-gray-500">
                    <span className="text-gray-400 capitalize">{h.action.replace('_', ' ')}</span>
                    {h.from && h.to && <span> · {h.from} → {h.to}</span>}
                    <div className="text-gray-600">{new Date(h.createdAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
