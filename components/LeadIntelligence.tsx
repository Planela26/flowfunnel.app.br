'use client'

import { useEffect, useState } from 'react'
import { Flame, Snowflake, Sun, TrendingUp, Users } from 'lucide-react'

type Lead = {
  identifier: string
  name: string
  phone: string
  email: string
  origin: string
  score: number
  classification: 'quente' | 'morno' | 'frio'
  signals: string[]
  totalEvents: number
  lastInteraction: string
  totalSpent: number
}

type Summary = {
  total: number
  quente: number
  morno: number
  frio: number
  avgScore: number
  totalRevenue: number
}

const SAMPLE_LEADS: Lead[] = [
  { identifier: 's1', name: 'Maria S.', phone: '+55 11 9****', email: '', origin: 'HOTMART', score: 92, classification: 'quente', signals: ['Já comprou', 'Ativo nas últimas 24h'], totalEvents: 6, lastInteraction: new Date().toISOString(), totalSpent: 297 },
  { identifier: 's2', name: 'João P.', phone: '+55 21 9****', email: '', origin: 'WHATSAPP', score: 78, classification: 'quente', signals: ['Iniciou checkout', 'Múltiplas interações'], totalEvents: 4, lastInteraction: new Date().toISOString(), totalSpent: 0 },
  { identifier: 's3', name: 'Ana C.', phone: '+55 31 9****', email: '', origin: 'META_ADS', score: 55, classification: 'morno', signals: ['Engajou no WhatsApp'], totalEvents: 3, lastInteraction: new Date().toISOString(), totalSpent: 0 },
  { identifier: 's4', name: 'Lucas M.', phone: '+55 11 9****', email: '', origin: 'KIWIFY', score: 22, classification: 'frio', signals: ['Sem interação há mais de 30 dias'], totalEvents: 1, lastInteraction: new Date().toISOString(), totalSpent: 0 },
  { identifier: 's5', name: 'Patrícia L.', phone: '+55 51 9****', email: '', origin: 'HOTMART', score: 88, classification: 'quente', signals: ['Já comprou', 'Alta frequência'], totalEvents: 5, lastInteraction: new Date().toISOString(), totalSpent: 197 },
]

interface Props {
  /** Quando false, renderiza dados de exemplo (preview para usuários sem o plano). */
  unlocked: boolean
}

export default function LeadIntelligence({ unlocked }: Props) {
  const [data, setData] = useState<{ leads: Lead[]; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(unlocked)

  useEffect(() => {
    if (!unlocked) return
    fetch('/api/leads/scored?days=30')
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setData({ leads: d.leads || [], summary: d.summary }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [unlocked])

  const leads = unlocked ? data?.leads ?? [] : SAMPLE_LEADS
  const summary: Summary = unlocked
    ? data?.summary ?? { total: 0, quente: 0, morno: 0, frio: 0, avgScore: 0, totalRevenue: 0 }
    : { total: 5, quente: 3, morno: 1, frio: 1, avgScore: 67, totalRevenue: 494 }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
            Inteligência de Leads
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
            PRO
          </span>
        </div>
        {unlocked && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Score médio: <strong className="text-gray-900 dark:text-white">{summary.avgScore}</strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 p-3 border-b border-gray-100 dark:border-gray-700">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 text-center">
          <Flame className="w-4 h-4 text-red-600 mx-auto mb-1" />
          <div className="text-lg font-extrabold text-red-700 dark:text-red-400">{summary.quente}</div>
          <div className="text-[10px] text-red-700 dark:text-red-300 font-semibold uppercase">Quentes</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 text-center">
          <Sun className="w-4 h-4 text-amber-600 mx-auto mb-1" />
          <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400">{summary.morno}</div>
          <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase">Mornos</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 text-center">
          <Snowflake className="w-4 h-4 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-extrabold text-blue-700 dark:text-blue-400">{summary.frio}</div>
          <div className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold uppercase">Frios</div>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Calculando scores…</div>
        ) : leads.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Nenhum lead nos últimos 30 dias. Conecte uma integração para começar.
          </div>
        ) : (
          leads.slice(0, 10).map(l => <LeadRow key={l.identifier} lead={l} />)
        )}
      </div>

      {leads.length > 10 && (
        <div className="px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
          Mostrando 10 de {leads.length} leads classificados
        </div>
      )}
    </div>
  )
}

function LeadRow({ lead }: { lead: Lead }) {
  const cls = lead.classification
  const scoreColor =
    cls === 'quente'
      ? 'bg-red-500'
      : cls === 'morno'
        ? 'bg-amber-500'
        : 'bg-blue-500'
  const badgeColor =
    cls === 'quente'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : cls === 'morno'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'

  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-10 h-10">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${(lead.score / 100) * 94.2} 94.2`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
            className={
              cls === 'quente'
                ? 'text-red-500'
                : cls === 'morno'
                  ? 'text-amber-500'
                  : 'text-blue-500'
            }
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-white">
          {lead.score}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {lead.name}
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${badgeColor}`}>
            {cls}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{lead.origin}</span>
          <span>•</span>
          <span>{lead.totalEvents} interações</span>
          {lead.totalSpent > 0 && (
            <>
              <span>•</span>
              <span className="text-green-600 dark:text-green-400 font-semibold">
                R${' '}
                {lead.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </>
          )}
        </div>
        {lead.signals.length > 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {lead.signals.slice(0, 2).join(' • ')}
          </p>
        )}
      </div>
    </div>
  )
}
