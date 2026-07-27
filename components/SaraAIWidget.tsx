'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, ChevronDown, RotateCcw, Loader2 } from 'lucide-react'

// ── Typing animation — 3 bouncing dots ──────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-blue-400 block"
          style={{
            animation: 'sara-bounce 1.1s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes sara-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// ── Quick-action chips shown when chat is empty ──────────────────────────────
const QUICK_ACTIONS = [
  { label: '🔍 Diagnosticar meu funil', prompt: 'Meu funil está funcionando bem? Faça um diagnóstico completo com os dados disponíveis.' },
  { label: '📊 Como estão minhas métricas?', prompt: 'Como estão minhas métricas atuais? O que está bem e o que precisa de atenção?' },
  { label: '💡 Sugestões para crescer', prompt: 'Com base nos meus dados, qual a principal ação que eu deveria tomar agora para aumentar minhas vendas?' },
  { label: '🔗 Como conectar o WhatsApp?', prompt: 'Como conecto meu WhatsApp Business à plataforma?' },
  { label: '📈 Meu ROI está bom?', prompt: 'Meu ROI está bom? Onde posso melhorar?' },
]

// ── Simple markdown renderer (bold, bullets, inline code) ───────────────────
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    const key = i
    // bullet
    if (/^[•\-\*] /.test(line)) {
      elements.push(
        <div key={key} className="flex gap-1.5 my-0.5">
          <span className="text-blue-400 mt-0.5 shrink-0">•</span>
          <span>{inlineFormat(line.replace(/^[•\-\*] /, ''))}</span>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key} className="h-1.5" />)
    } else {
      elements.push(<p key={key} className="my-0.5">{inlineFormat(line)}</p>)
    }
  })
  return elements
}

function inlineFormat(text: string): React.ReactNode {
  // **bold**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-gray-700 text-blue-300 px-1 rounded text-xs">{part.slice(1, -1)}</code>
    }
    return part
  })
}

// ── Widget ───────────────────────────────────────────────────────────────────
export default function SaraAIWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Placeholder streaming message
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('Falha na requisição')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.delta) {
              accumulated += parsed.delta
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: accumulated, streaming: true }
                return updated
              })
            }
          } catch {}
        }
      }

      // Finalize
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: accumulated, streaming: false }
        return updated
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
            streaming: false,
          }
          return updated
        })
      }
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const reset = () => {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    setLoading(false)
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`
          fixed bottom-5 right-5 z-[9998]
          flex items-center gap-2 pl-3 pr-4 py-2.5
          rounded-full shadow-2xl
          bg-gradient-to-r from-blue-600 to-blue-500
          text-white text-sm font-semibold
          transition-all duration-300 hover:scale-105 hover:shadow-blue-500/40
          ${open ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 scale-100'}
        `}
        aria-label="Abrir Sara.ai"
      >
        <Sparkles className="w-4 h-4 shrink-0" />
        <span>Sara.ai</span>
      </button>

      {/* ── Chat panel ── */}
      <div
        className={`
          fixed bottom-0 right-0 z-[9999]
          flex flex-col
          w-full sm:w-[380px] sm:bottom-5 sm:right-5
          h-[90dvh] sm:h-[600px]
          bg-gray-900 border border-gray-700/60
          sm:rounded-2xl shadow-2xl shadow-black/50
          transition-all duration-300 origin-bottom-right
          ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}
        `}
        style={{ maxHeight: 'calc(100dvh - 24px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60 bg-gradient-to-r from-blue-900/60 to-gray-900 sm:rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-gray-900" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">Sara.ai</p>
              <p className="text-gray-400 text-[11px] leading-none mt-0.5">Assistente da FlowSara</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 transition"
                title="Nova conversa"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 transition"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 pb-4">
              {/* Welcome */}
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mx-auto mb-3 shadow-xl">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-white font-bold text-base">Olá! Sou a Sara.ai</h3>
                <p className="text-gray-400 text-xs mt-1 max-w-[260px]">
                  Analiso seus dados, diagnostico seu funil e respondo qualquer dúvida sobre a plataforma.
                </p>
              </div>
              {/* Quick actions */}
              <div className="flex flex-col gap-2 w-full">
                {QUICK_ACTIONS.map(action => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    className="text-left px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500/50 text-gray-300 text-xs transition-all hover:text-white"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`
                    max-w-[90%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700/50'
                    }
                  `}
                >
                  {msg.role === 'assistant' ? (
                    <>
                      {msg.streaming && msg.content === '' ? (
                        <TypingDots />
                      ) : (
                        <>
                          {renderMarkdown(msg.content || ' ')}
                          {msg.streaming && (
                            <span className="inline-block w-1.5 h-3.5 bg-blue-400 rounded-sm ml-0.5 animate-pulse" />
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-gray-700/60 shrink-0 sm:rounded-b-2xl">
          <div className="flex items-end gap-2 bg-gray-800 rounded-xl border border-gray-700 focus-within:border-blue-500/60 transition-colors px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
              placeholder="Pergunte algo sobre seu funil…"
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 resize-none outline-none leading-relaxed max-h-28 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
              style={{ minHeight: '1.5rem' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                : <Send className="w-3.5 h-3.5 text-white" />
              }
            </button>
          </div>
          <p className="text-gray-600 text-[10px] text-center mt-1.5">Sara.ai · Resultados podem variar</p>
        </div>
      </div>
    </>
  )
}
