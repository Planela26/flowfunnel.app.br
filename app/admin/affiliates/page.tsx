'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Copy, Plus, Check, Users, TrendingUp, DollarSign, Tag,
  ExternalLink, ToggleLeft, ToggleRight, Pencil, RefreshCw, ShoppingCart, X
} from 'lucide-react'

interface Affiliate {
  id: string
  name: string
  email: string | null
  code: string
  discountPercent: number
  commissionPercent: number
  isActive: boolean
  clicks: number
  sales: number
  totalCommission: number
  createdAt: string
}

interface Sale {
  id: string
  plan: string
  originalAmount: number
  discountedAmount: number
  commissionAmount: number
  createdAt: string
  stripePaymentId: string
  affiliate: { name: string; code: string }
}

const emptyForm = { name: '', email: '', code: '', discountPercent: 10, commissionPercent: 20 }

function generateCode(name: string) {
  const base = name.trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)
  const num = Math.floor(Math.random() * 90) + 10
  return base ? `${base}${num}` : `REF${num}${Math.floor(Math.random() * 100)}`
}

export default function AdminAffiliatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<'affiliates' | 'sales'>('affiliates')
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Affiliate | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const fetchAffiliates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/affiliates')
      const data = await res.json()
      setAffiliates(data.affiliates || [])
    } catch {}
    setLoading(false)
  }, [])

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch('/api/affiliates/sales')
      const data = await res.json()
      setSales(data.sales || [])
    } catch {}
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if ((session?.user as any)?.role !== 'ADMIN') {
        router.push('/dashboard')
        return
      }
      fetchAffiliates()
      fetchSales()
    }
  }, [status, session, router, fetchAffiliates, fetchSales])

  const openCreate = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const openEdit = (a: Affiliate) => {
    setEditTarget(a)
    setForm({ name: a.name, email: a.email || '', code: a.code, discountPercent: a.discountPercent, commissionPercent: a.commissionPercent })
    setError('')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url = editTarget ? `/api/affiliates/${editTarget.id}` : '/api/affiliates'
      const method = editTarget ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setSaving(false); return }
      setShowForm(false)
      setForm(emptyForm)
      setEditTarget(null)
      fetchAffiliates()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  const toggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/affiliates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    fetchAffiliates()
  }

  const copyLink = (code: string, id: string) => {
    const url = `${window.location.origin}/?ref=${code}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const totalCommission = affiliates.reduce((s, a) => s + a.totalCommission, 0)
  const totalSales = affiliates.reduce((s, a) => s + a.sales, 0)
  const totalClicks = affiliates.reduce((s, a) => s + a.clicks, 0)
  const totalDiscount = sales.reduce((s, v) => s + (v.originalAmount - v.discountedAmount), 0)

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Painel de Afiliados</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie afiliados, cupons e comissões</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition text-sm"
          >
            <Plus className="w-4 h-4" /> Novo Afiliado
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total de Cliques', value: totalClicks, icon: Users, color: 'blue' },
            { label: 'Total de Vendas', value: totalSales, icon: ShoppingCart, color: 'green' },
            { label: 'Descontos Dados', value: `R$ ${totalDiscount.toFixed(2)}`, icon: Tag, color: 'orange' },
            { label: 'Comissões Geradas', value: `R$ ${totalCommission.toFixed(2)}`, icon: DollarSign, color: 'purple' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className={`w-9 h-9 rounded-xl bg-${color}-100 flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 text-${color}-600`} />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 w-fit border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setTab('affiliates')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${tab === 'affiliates' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Afiliados ({affiliates.length})
          </button>
          <button
            onClick={() => setTab('sales')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${tab === 'sales' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Vendas ({sales.length})
          </button>
        </div>

        {/* Affiliates Table */}
        {tab === 'affiliates' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Lista de Afiliados</h2>
              <button onClick={fetchAffiliates} className="text-gray-400 hover:text-blue-600 transition">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {affiliates.length === 0 ? (
              <div className="py-16 text-center">
                <Tag className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Nenhum afiliado cadastrado ainda</p>
                <button onClick={openCreate} className="mt-4 text-blue-600 text-sm font-medium hover:underline">
                  Criar primeiro afiliado
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="px-6 py-3 text-left">Afiliado</th>
                      <th className="px-6 py-3 text-left">Código / Link</th>
                      <th className="px-6 py-3 text-center">Desconto</th>
                      <th className="px-6 py-3 text-center">Comissão</th>
                      <th className="px-6 py-3 text-center">Cliques</th>
                      <th className="px-6 py-3 text-center">Vendas</th>
                      <th className="px-6 py-3 text-right">Comissão Total</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {affiliates.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/60 transition">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">{a.name}</p>
                          {a.email && <p className="text-xs text-gray-400 dark:text-gray-500">{a.email}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg font-bold">
                            {a.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-green-700 dark:text-green-400 font-semibold text-sm">{a.discountPercent}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-purple-700 dark:text-purple-400 font-semibold text-sm">{a.commissionPercent}%</span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-300">{a.clicks}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-300">{a.sales}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-gray-900 text-sm">R$ {a.totalCommission.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => toggleActive(a.id, a.isActive)} className="transition" title={a.isActive ? 'Desativar' : 'Ativar'}>
                            {a.isActive
                              ? <ToggleRight className="w-7 h-7 text-green-500" />
                              : <ToggleLeft className="w-7 h-7 text-gray-300" />
                            }
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEdit(a)}
                              title="Editar afiliado"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => copyLink(a.code, a.id)}
                              title="Copiar link de afiliado"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              {copiedId === a.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <a
                              href={`/affiliate/dashboard?code=${a.code}`}
                              target="_blank"
                              title="Ver dashboard do afiliado"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sales Table */}
        {tab === 'sales' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Histórico de Vendas</h2>
              <button onClick={fetchSales} className="text-gray-400 hover:text-blue-600 transition">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {sales.length === 0 ? (
              <div className="py-16 text-center">
                <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Nenhuma venda registrada ainda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-6 py-3 text-left">Data</th>
                      <th className="px-6 py-3 text-left">Afiliado</th>
                      <th className="px-6 py-3 text-center">Plano</th>
                      <th className="px-6 py-3 text-right">Valor Original</th>
                      <th className="px-6 py-3 text-right">Desconto</th>
                      <th className="px-6 py-3 text-right">Valor Final</th>
                      <th className="px-6 py-3 text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sales.map(s => {
                      const discount = s.originalAmount - s.discountedAmount
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition">
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {new Date(s.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900 text-sm">{s.affiliate.name}</p>
                            <span className="font-mono text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                              {s.affiliate.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">{s.plan}</span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-500">
                            R$ {s.originalAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-red-500">
                            - R$ {discount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-gray-900 text-sm">R$ {s.discountedAmount.toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-semibold text-purple-700 text-sm">R$ {s.commissionAmount.toFixed(2)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-100">
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total</td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">
                        R$ {sales.reduce((s, v) => s + v.originalAmount, 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-red-500">
                        - R$ {totalDiscount.toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                        R$ {sales.reduce((s, v) => s + v.discountedAmount, 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-purple-700">
                        R$ {totalCommission.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create / Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative">
              <button
                onClick={() => { setShowForm(false); setError(''); setEditTarget(null) }}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                {editTarget ? 'Editar Afiliado' : 'Novo Afiliado'}
              </h2>
              {error && <p className="text-red-600 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Nome *</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Ex: Amélia Santos"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="amelia@email.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Código Promocional *</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 uppercase font-mono"
                      placeholder="Ex: AMELIA10"
                      value={form.code}
                      onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                      required
                      disabled={!!editTarget}
                    />
                    {!editTarget && (
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, code: generateCode(p.name) }))}
                        title="Gerar código automaticamente"
                        className="px-3 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition text-xs font-medium whitespace-nowrap"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {!editTarget && (
                    <p className="text-xs text-gray-400 mt-1">Clique no botão para gerar automaticamente com base no nome</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Desconto (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={form.discountPercent}
                      onChange={e => setForm(p => ({ ...p, discountPercent: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Comissão (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      value={form.commissionPercent}
                      onChange={e => setForm(p => ({ ...p, commissionPercent: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setError(''); setEditTarget(null) }}
                    className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-60"
                  >
                    {saving ? 'Salvando...' : editTarget ? 'Salvar Alterações' : 'Criar Afiliado'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
