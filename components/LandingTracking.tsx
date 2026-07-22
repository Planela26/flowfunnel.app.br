'use client'

import { useEffect, useState } from 'react'
import { Eye, MessageCircle, ShoppingCart, TrendingUp, Copy, Check, Code2, ChevronDown } from 'lucide-react'

type Stats = {
  days: number
  summary: {
    leads: number
    pageViews: number
    clickWhatsapp: number
    clickCheckout: number
    conversions: number
    revenue: number
    conversionRate: number
  }
  origins: Array<{ source: string; campaign: string; leads: number }>
}

type Install = {
  siteId: string
  scriptUrl: string
  snippet: string
  instructions: { headTag: string; buttons: string; conversion: string }
}

export default function LandingTracking() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [install, setInstall] = useState<Install | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/track/stats?days=30').then(r => (r.ok ? r.json() : null)),
      fetch('/api/track/install').then(r => (r.ok ? r.json() : null)),
    ])
      .then(([s, i]) => {
        if (s) setStats(s)
        if (i) setInstall(i)
      })
      .finally(() => setLoading(false))
  }, [])

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  const s = stats?.summary
  const hasData = (s?.leads ?? 0) > 0 || (s?.pageViews ?? 0) > 0

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
            Rastreamento de Landing Page
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">últimos 30 dias</span>
        </div>
        <button
          onClick={() => setShowInstall(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <Code2 className="w-4 h-4" />
          Como instalar
          <ChevronDown className={`w-3 h-3 transition ${showInstall ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
        <Card icon={<Eye className="w-4 h-4" />} color="blue" label="Visitas" value={s?.pageViews ?? 0} />
        <Card icon={<MessageCircle className="w-4 h-4" />} color="green" label="Clique WhatsApp" value={s?.clickWhatsapp ?? 0} />
        <Card icon={<ShoppingCart className="w-4 h-4" />} color="purple" label="Clique Checkout" value={s?.clickCheckout ?? 0} />
        <Card
          icon={<TrendingUp className="w-4 h-4" />}
          color="amber"
          label="Conversões"
          value={s?.conversions ?? 0}
          subtitle={s ? `R$ ${s.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined}
        />
      </div>

      {/* Origens */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Origem dos leads (UTM)
          </h4>
          {s && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Taxa de conversão: <strong className="text-gray-900 dark:text-white">{s.conversionRate}%</strong>
            </span>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 py-3">Carregando…</p>
        ) : !hasData ? (
          <div className="text-center py-6 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Nenhum dado ainda. Instale o script na sua landing page para começar a rastrear.
            </p>
            <button
              onClick={() => setShowInstall(true)}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ver instruções de instalação →
            </button>
          </div>
        ) : stats!.origins.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">Nenhuma origem identificada.</p>
        ) : (
          <div className="space-y-1.5">
            {stats!.origins.map((o, i) => {
              const max = stats!.origins[0].leads || 1
              const pct = (o.leads / max) * 100
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        {o.source}
                        {o.campaign !== '—' && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal"> · {o.campaign}</span>
                        )}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 font-bold flex-shrink-0">{o.leads}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Instruções de instalação */}
      {showInstall && install && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
              1. Cole no &lt;head&gt; da sua landing page
            </p>
            <CodeBlock value={install.snippet} onCopy={() => copy(install.snippet, 'snippet')} copied={copied === 'snippet'} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
              2. Em qualquer botão personalizado
            </p>
            <CodeBlock
              value={`onclick="trackEvent('clicou_no_botao_x')"`}
              onCopy={() => copy("onclick=\"trackEvent('clicou_no_botao_x')\"", 'btn')}
              copied={copied === 'btn'}
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
              3. Após uma venda confirmada (na thank-you page)
            </p>
            <CodeBlock
              value={`<script>window.zfTrackConversion(197.00, "Curso XYZ")</script>`}
              onCopy={() => copy('<script>window.zfTrackConversion(197.00, "Curso XYZ")</script>', 'conv')}
              copied={copied === 'conv'}
            />
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed pt-2 border-t border-gray-200 dark:border-gray-700">
            <p>✓ UTMs são capturadas e propagadas automaticamente.</p>
            <p>✓ <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">lead_id</code> é injetado em links de checkout (Hotmart, Kiwify, Eduzz, Monetizze, Stripe).</p>
            <p>✓ Cliques em links do WhatsApp (wa.me, api.whatsapp.com) são rastreados sozinhos.</p>
            <p>✓ Não interfere em pixels do Facebook, Google ou seu tracker atual.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ icon, label, value, color, subtitle }: { icon: React.ReactNode; label: string; value: number; color: 'blue' | 'green' | 'purple' | 'amber'; subtitle?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  }
  return (
    <div className={`rounded-lg p-3 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 mb-1 opacity-90">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-extrabold">{value.toLocaleString('pt-BR')}</div>
      {subtitle && <div className="text-[11px] opacity-80 mt-0.5">{subtitle}</div>}
    </div>
  )
}

function CodeBlock({ value, onCopy, copied }: { value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-3 pr-10 overflow-x-auto font-mono">
        <code>{value}</code>
      </pre>
      <button
        onClick={onCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
        aria-label="Copiar"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
