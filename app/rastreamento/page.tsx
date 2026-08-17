'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Link2, Copy, Check, Plus, Trash2, Code2, ChevronDown, ChevronUp,
  CircleDot, Loader2, ExternalLink, AlertCircle,
} from 'lucide-react'

type Site = {
  id: string
  slug: string
  label: string
  destinationUrl: string
  isActive: boolean
  lastVisitAt: string | null
  visitCount: number
  trackingUrl: string
}

/** "há 3 minutos", "há 2 dias" — mais legível que data crua num painel de status. */
function desdeQuando(iso: string | null): string {
  if (!iso) return 'nenhuma visita ainda'
  const seg = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seg < 60) return 'agora mesmo'
  const min = Math.floor(seg / 60)
  if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} ${h === 1 ? 'hora' : 'horas'}`
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(texto).then(() => {
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        })
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
    >
      {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}

export default function RastreamentoPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [carregando, setCarregando] = useState(true)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')
  const [avancado, setAvancado] = useState(false)
  const [snippet, setSnippet] = useState('')

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/track/sites')
      const d = await r.json()
      setSites(d.sites ?? [])
    } catch {}
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    fetch('/api/track/install').then(r => r.json()).then(d => setSnippet(d.snippet || '')).catch(() => {})
  }, [])

  const criar = async () => {
    setErro(''); setCriando(true)
    try {
      const r = await fetch('/api/track/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationUrl: url, label }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Não foi possível gerar o link.')
      setUrl(''); setLabel('')
      await carregar()
    } catch (e: any) {
      setErro(e.message)
    }
    setCriando(false)
  }

  const remover = async (id: string) => {
    await fetch(`/api/track/sites?id=${id}`, { method: 'DELETE' })
    await carregar()
  }

  const totalVisitas = sites.reduce((a, s) => a + s.visitCount, 0)
  const ultima = sites
    .map(s => s.lastVisitAt)
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rastreamento da Landing Page</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Descubra de onde vem cada visita, lead e venda.
        </p>
      </div>

      {/* ── Status ─────────────────────────────────────────────────────── */}
      {sites.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <CircleDot className={`h-4 w-4 ${ultima ? 'text-green-500' : 'text-gray-400'}`} />
              <span className={`text-sm font-semibold ${ultima ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                {ultima ? 'Rastreamento ativo' : 'Aguardando a primeira visita'}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Última visita: <strong>{desdeQuando(ultima)}</strong>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Visitas rastreadas: <strong>{totalVisitas.toLocaleString('pt-BR')}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ── Método recomendado ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-green-200 bg-white dark:border-green-900/50 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Recomendado
            </span>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Rastreamento por link</h2>
          </div>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Não precisa instalar nenhum código no seu site. Gere um link e use nas suas campanhas.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://meusite.com.br"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Nome para identificar (opcional). Ex.: Página do curso"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <button
              onClick={criar}
              disabled={criando || !url.trim()}
              className="inline-flex h-fit items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Gerar link rastreável
            </button>
          </div>

          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {erro}
            </div>
          )}

          {carregando ? (
            <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /></div>
          ) : sites.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">
              Cadastre sua landing page acima para gerar o primeiro link.
            </p>
          ) : (
            <div className="space-y-3">
              {sites.map(s => (
                <div key={s.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{s.label}</p>
                      <a
                        href={s.destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-gray-400 hover:text-blue-500"
                      >
                        {s.destinationUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <button
                      onClick={() => remover(s.id)}
                      title="Remover link"
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-mono text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
                      {s.trackingUrl}
                    </code>
                    <BotaoCopiar texto={s.trackingUrl} />
                  </div>

                  <div className="mt-2.5 flex items-center gap-4 text-[11px] text-gray-400">
                    <span><Link2 className="mr-1 inline h-3 w-3" />{s.visitCount.toLocaleString('pt-BR')} visitas</span>
                    <span>Última: {desdeQuando(s.lastVisitAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              Use este link nos seus anúncios, campanhas e divulgações. O FlowSara registra a
              origem da visita e mantém a atribuição durante a jornada.
            </p>
          </div>
        </div>
      </div>

      {/* ── Método avançado ────────────────────────────────────────────────
          Recolhido por padrão, mas com o limite do método por link dito de
          forma direta: sem o código na página, a VENDA não é ligada à campanha.
          Esconder isso levaria o cliente a achar que o relatório de vendas por
          origem está quebrado, quando na verdade falta a instalação. */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <button
          onClick={() => setAvancado(!avancado)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-gray-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Rastreamento avançado</h2>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Instale o código na página para rastrear a jornada inteira e ligar cada venda à campanha.
            </p>
          </div>
          {avancado ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
        </button>

        {avancado && (
          <div className="space-y-4 border-t border-gray-100 px-5 py-5 dark:border-gray-800">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-900/20">
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                <strong>Por que instalar também:</strong> o link rastreável registra de onde veio a
                visita, mas o FlowSara não enxerga o que acontece dentro da sua página. Com o código
                instalado, passam a ser rastreados os cliques no WhatsApp, no checkout, e a
                <strong> venda é ligada à campanha que a gerou</strong>. Sem ele, a venda chega sem
                origem identificada.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                Cole este código dentro da tag <code className="rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800">&lt;head&gt;</code> da sua landing page:
              </p>
              <div className="flex items-start gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {snippet || 'Carregando…'}
                </code>
                {snippet && <BotaoCopiar texto={snippet} />}
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Funciona em WordPress, Elementor, Wix, ClickFunnels, HTML puro e qualquer plataforma
              que permita inserir código no cabeçalho. Os dois métodos podem ser usados juntos — o
              link garante a origem e o código completa a jornada.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
