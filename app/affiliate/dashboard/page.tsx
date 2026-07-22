'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TrendingUp, DollarSign, MousePointerClick, Tag, Copy, Check, ExternalLink } from 'lucide-react'

interface Stats {
  clicks: number
  sales: number
  totalCommission: number
  totalRevenue: number
}

interface Sale {
  id: string
  plan: string
  originalAmount: number
  discountedAmount: number
  commissionAmount: number
  createdAt: string
}

interface AffiliateInfo {
  id: string
  name: string
  email: string | null
  code: string
  discountPercent: number
  commissionPercent: number
  isActive: boolean
}

function AffiliateDashboardContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code') || ''

  const [affiliate, setAffiliate] = useState<AffiliateInfo | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    if (!code) { setError('Código de afiliado não informado'); setLoading(false); return }
    setLoading(true)
    try {
      const validateRes = await fetch('/api/affiliates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const validateData = await validateRes.json()
      if (!validateData.valid) { setError('Código inválido ou inativo'); setLoading(false); return }

      const statsRes = await fetch(`/api/affiliates/${validateData.affiliate.id}`)
      const statsData = await statsRes.json()
      setAffiliate(statsData.affiliate)
      setStats(statsData.stats)
      setSales(statsData.recentSales || [])
    } catch {
      setError('Erro ao carregar dados')
    }
    setLoading(false)
  }, [code])

  useEffect(() => { fetchData() }, [fetchData])

  const affiliateLink = affiliate ? `${window.location.origin}/?ref=${affiliate.code}` : ''

  const copyLink = () => {
    navigator.clipboard.writeText(affiliateLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !affiliate || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-10 text-center max-w-sm w-full shadow-2xl">
          <div className="text-4xl mb-4">🔗</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso ao Dashboard</h2>
          <p className="text-red-600 text-sm">{error || 'Código inválido'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-blue-300 text-sm font-medium mb-1">Dashboard do Afiliado</p>
              <h1 className="text-2xl font-bold">{affiliate.name}</h1>
              {affiliate.email && <p className="text-blue-300 text-sm mt-0.5">{affiliate.email}</p>}
            </div>
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-4 py-2">
              <Tag className="w-4 h-4 text-blue-300" />
              <span className="font-mono font-bold text-lg">{affiliate.code}</span>
              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Ativo</span>
            </div>
          </div>

          {/* Affiliate Link */}
          <div className="mt-6 bg-white/10 border border-white/20 rounded-2xl p-4">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-2">Seu link de afiliado</p>
            <div className="flex items-center gap-3">
              <p className="text-white text-sm font-mono flex-1 truncate">{affiliateLink}</p>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex-shrink-0"
              >
                {copied ? <><Check className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
              </button>
              <a
                href={affiliateLink}
                target="_blank"
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Rates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl font-black text-green-600">{affiliate.discountPercent}%</p>
            <p className="text-gray-500 text-sm mt-1">Desconto oferecido</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl font-black text-purple-600">{affiliate.commissionPercent}%</p>
            <p className="text-gray-500 text-sm mt-1">Sua comissão</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total de Cliques', value: stats.clicks, icon: MousePointerClick, color: 'blue' },
            { label: 'Total de Vendas', value: stats.sales, icon: TrendingUp, color: 'green' },
            { label: 'Comissão Acumulada', value: `R$ ${stats.totalCommission.toFixed(2)}`, icon: DollarSign, color: 'purple' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className={`w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Vendas Recentes</h2>
          </div>
          {sales.length === 0 ? (
            <div className="py-12 text-center">
              <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhuma venda ainda. Compartilhe seu link!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left">Plano</th>
                    <th className="px-6 py-3 text-right">Valor Original</th>
                    <th className="px-6 py-3 text-right">Valor Pago</th>
                    <th className="px-6 py-3 text-right">Sua Comissão</th>
                    <th className="px-6 py-3 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sales.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{s.plan}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-500 line-through">R$ {s.originalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">R$ {s.discountedAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-green-600">R$ {s.commissionAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-xs text-gray-400">
                        {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AffiliateDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <AffiliateDashboardContent />
    </Suspense>
  )
}
