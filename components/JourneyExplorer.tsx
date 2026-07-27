'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MousePointerClick, MessageCircle, ShoppingCart, CheckCircle2,
  Eye, RefreshCw, ChevronRight, Clock, Target, Link2, HelpCircle,
} from 'lucide-react'

interface LeadRow {
  leadId: string
  utmSource: string | null
  utmCampaign: string | null
  referrer: string | null
  firstSeen: string
  events: Record<string, number>
  sales: { platform: string; value: number; method: string }[]
}

interface JourneyStep {
  at: string
  type: string
  source: string
  label: string
  detail?: Record<string, any>
}

interface Journey {
  leadId: string
  origin: {
    utmSource: string | null
    utmCampaign: string | null
    utmMedium: string | null
    fbclid: string | null
    gclid: string | null
    referrer: string | null
    firstUrl: string | null
  } | null
  firstSeen: string | null
  steps: JourneyStep[]
  sales: {
    platform: string
    value: number
    currency: string
    product: string | null
    method: string
    matchedBy: string | null
    confidence: number
  }[]
  durations: { clickToWhatsAppMs: number | null; clickToPurchaseMs: number | null }
}

const STEP_ICONS: Record<string, any> = {
  page_view: Eye,
  scroll_60: Eye,
  click_whatsapp: MessageCircle,
  click_checkout: ShoppingCart,
  conversion: CheckCircle2,
  purchase: CheckCircle2,
}

const METHOD_BADGE: Record<string, { label: string; cls: string }> = {
  deterministic: { label: 'Determinística', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  probabilistic: { label: 'Probabilística', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  unmatched: { label: 'Sem vínculo', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
}

function fmtDuration(ms: number | null): string {
  if (ms == null || ms < 0) return '—'
  const min = Math.floor(ms / 60000)
  if (min < 1) return '< 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ${min % 60}min`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function JourneyExplorer() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [unmatchedSales, setUnmatchedSales] = useState<{ platform: string; value: number; currency: string; transactionId: string; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [journey, setJourney] = useState<Journey | null>(null)
  const [journeyLoading, setJourneyLoading] = useState(false)
  const [journeyError, setJourneyError] = useState<string | null>(null)
  const [onlySales, setOnlySales] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/journey?days=30&onlySales=${onlySales}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setUnmatchedSales(data.unmatchedSales || [])
    } catch (e: any) {
      setLoadError(e.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [onlySales])

  useEffect(() => { load() }, [load])

  const openJourney = async (leadId: string) => {
    setSelected(leadId)
    setJourneyLoading(true)
    setJourney(null)
    setJourneyError(null)
    try {
      const res = await fetch(`/api/journey/${encodeURIComponent(leadId)}`)
      if (!res.ok) throw new Error(res.status === 404 ? 'Jornada não encontrada.' : `Erro HTTP ${res.status}`)
      setJourney(await res.json())
    } catch (e: any) {
      setJourneyError(e.message || 'Erro ao carregar jornada')
    } finally {
      setJourneyLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lista de leads */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-violet-500" /> Leads rastreados (30 dias)
          </h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={onlySales}
                onChange={e => setOnlySales(e.target.checked)}
                className="rounded border-gray-300"
              />
              Só com venda
            </label>
            <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Atualizar">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Carregando…</p>
        ) : loadError ? (
          <p className="text-sm text-red-500 py-8 text-center">{loadError}</p>
        ) : leads.length === 0 ? (
          <div className="text-center py-8">
            <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhum lead rastreado ainda.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Instale o pixel da FlowSara na sua landing page para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {leads.map(l => (
              <button
                key={l.leadId}
                onClick={() => openJourney(l.leadId)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected === l.leadId
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{l.leadId}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {l.utmSource || 'direto'}{l.utmCampaign ? ` · ${l.utmCampaign}` : ''}
                  </span>
                  {(l.events['click_whatsapp'] || 0) > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      WhatsApp
                    </span>
                  )}
                  {(l.events['click_checkout'] || 0) > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                      Checkout
                    </span>
                  )}
                  {l.sales.length > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium">
                      💰 R$ {l.sales.reduce((s, v) => s + v.value, 0).toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{fmtTime(l.firstSeen)}</p>
              </button>
            ))}
          </div>
        )}


        {/* Vendas sem lead vinculado */}
        {!loading && !loadError && unmatchedSales.length > 0 && (
          <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
              Vendas sem vínculo ({unmatchedSales.length})
            </p>
            <div className="space-y-1">
              {unmatchedSales.map(s => (
                <div key={s.transactionId} className="text-xs flex items-center justify-between text-gray-500 dark:text-gray-400 py-0.5">
                  <span className="truncate mr-2">{s.platform} · {s.currency} {s.value.toFixed(2)}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">{fmtTime(s.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline da jornada */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-violet-500" /> Jornada completa
        </h2>

        {!selected ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            Selecione um lead ao lado para ver a jornada completa.
          </p>
        ) : journeyLoading ? (
          <p className="text-sm text-gray-400 py-12 text-center">Carregando jornada…</p>
        ) : journeyError ? (
          <p className="text-sm text-red-500 py-12 text-center">{journeyError}</p>
        ) : !journey ? (
          <p className="text-sm text-gray-400 py-12 text-center">Jornada não encontrada.</p>
        ) : (
          <div>
            {/* Origem */}
            <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <p className="text-[11px] uppercase tracking-widest text-blue-500 font-semibold mb-1">Origem</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {journey.origin?.utmSource || 'Tráfego direto'}
                {journey.origin?.utmCampaign && <> · campanha <b>{journey.origin.utmCampaign}</b></>}
                {journey.origin?.utmMedium && <> · {journey.origin.utmMedium}</>}
              </p>
              {(journey.origin?.fbclid || journey.origin?.gclid) && (
                <p className="text-[11px] text-blue-500 mt-1 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  {journey.origin.fbclid ? 'Click ID do Meta capturado' : 'Click ID do Google capturado'}
                </p>
              )}
            </div>

            {/* Durações */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Clique → WhatsApp</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {fmtDuration(journey.durations.clickToWhatsAppMs)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Clique → Compra</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {fmtDuration(journey.durations.clickToPurchaseMs)}
                </p>
              </div>
            </div>

            {/* Vendas atribuídas */}
            {journey.sales.length > 0 && (
              <div className="mb-4 space-y-2">
                {journey.sales.map((s, i) => {
                  const badge = METHOD_BADGE[s.method] || METHOD_BADGE.unmatched
                  return (
                    <div key={i} className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          {s.currency} {s.value.toFixed(2)} · {s.platform}
                        </p>
                        {s.product && <p className="text-xs text-emerald-600 dark:text-emerald-400">{s.product}</p>}
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`} title={s.matchedBy || ''}>
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Timeline */}
            <div className="relative pl-6 space-y-3 max-h-[320px] overflow-y-auto">
              <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gray-200 dark:bg-gray-700" />
              {journey.steps.map((step, i) => {
                const Icon = STEP_ICONS[step.type] || MousePointerClick
                const isSale = step.type === 'purchase' || step.type === 'conversion'
                return (
                  <div key={i} className="relative">
                    <div className={`absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ${
                      isSale ? 'bg-emerald-500' : 'bg-violet-500'
                    }`}>
                      <Icon className="w-2.5 h-2.5 text-white" />
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{step.label}</p>
                    <p className="text-[11px] text-gray-400">{fmtTime(step.at)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
