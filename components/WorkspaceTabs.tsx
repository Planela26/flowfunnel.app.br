'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, Settings2, ChevronDown, MessageCircle, BarChart3, Loader2 } from 'lucide-react'
import { usePlan } from '@/components/usePlan'

export interface Workspace {
  id: string
  name: string
  emoji: string
  isDefault: boolean
  whatsappIntegrationId: string | null
  whatsappNickname: string | null
  phoneNumberId: string | null
  facebookCampaignId: string | null
  facebookCampaignName: string | null
  facebookCampaignStatus: string | null
  trafficSources?: string[]
  checkoutSources?: string[]
}

interface WorkspaceTabsProps {
  onWorkspaceChange: (workspace: Workspace | null) => void
}

const EMOJIS = ['🚀', '🎯', '💡', '📣', '🔥', '⚡', '💎', '🌟', '📦', '🎪']

export default function WorkspaceTabs({ onWorkspaceChange }: WorkspaceTabsProps) {
  const { info: planInfo } = usePlan()
  const isProOrScale = planInfo.plan === 'PRO' || planInfo.plan === 'SCALE'
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditId, setShowEditId] = useState<string | null>(null)

  // Dados para o modal de criação/edição
  const [form, setForm] = useState({ name: '', emoji: '🚀', whatsappIntegrationId: '', facebookCampaignId: '', trafficSources: ['facebook'] as string[], checkoutSources: ['hotmart'] as string[] })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [planLimitInfo, setPlanLimitInfo] = useState<{ message: string; upgradeUrl: string; currentPlan?: string; limit?: number } | null>(null)
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([])
  const [availableCampaigns, setAvailableCampaigns] = useState<any[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces')
      const data = await res.json()
      if (data.workspaces) {
        setWorkspaces(data.workspaces)
        // Selecionar o padrão ou o primeiro
        const def = data.workspaces.find((w: Workspace) => w.isDefault) || data.workspaces[0]
        if (def && !selected) {
          setSelected(def.id)
          onWorkspaceChange(def)
        } else if (selected) {
          const current = data.workspaces.find((w: Workspace) => w.id === selected)
          if (current) onWorkspaceChange(current)
        }
      }
    } catch {}
    finally { setLoading(false) }
  }, [selected, onWorkspaceChange])

  const fetchOptions = async () => {
    setLoadingOptions(true)
    try {
      const [numRes, campRes] = await Promise.all([
        fetch('/api/integrations/whatsapp'),
        fetch('/api/campaigns'),
      ])
      const numData = await numRes.json()
      const campData = await campRes.json()
      setAvailableNumbers(numData.numbers || [])
      setAvailableCampaigns(campData.campaigns || [])
    } catch {}
    finally { setLoadingOptions(false) }
  }

  useEffect(() => { fetchWorkspaces() }, [])

  const selectWorkspace = (ws: Workspace) => {
    setSelected(ws.id)
    onWorkspaceChange(ws)
  }

  const toggleSource = (src: string) => {
    setForm((f) => {
      const has = f.trafficSources.includes(src)
      const next = has
        ? f.trafficSources.filter((s) => s !== src)
        : [...f.trafficSources, src]
      if (next.length === 0) return f
      return { ...f, trafficSources: next }
    })
  }

  const openNewModal = () => {
    setForm({ name: '', emoji: '🚀', whatsappIntegrationId: '', facebookCampaignId: '', trafficSources: ['facebook'], checkoutSources: ['hotmart'] })
    setFormError('')
    setShowNewModal(true)
    fetchOptions()
  }

  const openEditModal = (ws: Workspace) => {
    setForm({
      name: ws.name,
      emoji: ws.emoji,
      whatsappIntegrationId: ws.whatsappIntegrationId || '',
      facebookCampaignId: ws.facebookCampaignId || '',
      trafficSources: ws.trafficSources || ['facebook'],
      checkoutSources: ws.checkoutSources || ['hotmart'],
    })
    setFormError('')
    setShowEditId(ws.id)
    fetchOptions()
  }

  const createWorkspace = async () => {
    if (!form.name.trim()) { setFormError('Nome obrigatório'); return }
    setFormLoading(true)
    setFormError('')
    setPlanLimitInfo(null)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402 && data.error === 'plan_limit_reached') {
          setPlanLimitInfo({
            message: data.message || 'Você atingiu o limite de funis do seu plano.',
            upgradeUrl: data.upgradeUrl || '/billing',
            currentPlan: data.currentPlan,
            limit: data.limit,
          })
          return
        }
        setFormError(data.error || 'Erro ao criar')
        return
      }
      setShowNewModal(false)
      await fetchWorkspaces()
      setSelected(data.workspace.id)
      onWorkspaceChange(data.workspace)
    } catch { setFormError('Erro de conexão') }
    finally { setFormLoading(false) }
  }

  const updateWorkspace = async () => {
    if (!form.name.trim()) { setFormError('Nome obrigatório'); return }
    setFormLoading(true)
    setFormError('')
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: showEditId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Erro ao salvar'); return }
      setShowEditId(null)
      await fetchWorkspaces()
    } catch { setFormError('Erro de conexão') }
    finally { setFormLoading(false) }
  }

  const deleteWorkspace = async (id: string) => {
    if (!confirm('Remover este funil do dashboard? Os dados não serão apagados.')) return
    try {
      await fetch(`/api/workspaces?id=${id}`, { method: 'DELETE' })
      await fetchWorkspaces()
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <span className="text-sm text-gray-500">Carregando funis...</span>
      </div>
    )
  }

  return (
    <>
      {/* Barra de abas */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
        <div className="flex items-end gap-1 overflow-x-auto pb-0 scrollbar-hide">
          {workspaces.map((ws) => {
            const isSelected = selected === ws.id
            return (
              <div
                key={ws.id}
                className={`group flex items-center gap-2 px-4 py-2.5 rounded-t-lg border border-b-0 cursor-pointer transition-all shrink-0 ${
                  isSelected
                    ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-blue-700 dark:text-blue-400 -mb-px z-10'
                    : 'bg-transparent border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
                onClick={() => selectWorkspace(ws)}
              >
                <span className="text-base leading-none">{ws.emoji}</span>
                <span className={`text-sm font-medium whitespace-nowrap ${isSelected ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                  {ws.name}
                </span>

                {/* Indicadores de conexão */}
                <div className="flex items-center gap-0.5">
                  {ws.phoneNumberId && (
                    <span title={`WhatsApp: ${ws.whatsappNickname}`} className="w-2 h-2 bg-green-500 rounded-full" />
                  )}
                  {ws.facebookCampaignId && (
                    <span title={`Facebook: ${ws.facebookCampaignName}`} className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>

                {/* Editar (aparece no hover ou quando selecionado) */}
                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(ws) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    <Settings2 className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>
            )
          })}

          {/* Botão + nova aba */}
          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-3 py-2 mb-1 ml-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-lg transition shrink-0 font-bold text-xs"
            title="Novo funil"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">+ Novo Funil</span>
          </button>
        </div>
      </div>

      {/* Info do workspace selecionado */}
      {selected && (() => {
        const ws = workspaces.find((w) => w.id === selected)
        if (!ws) return null
        const hasConnections = ws.phoneNumberId || ws.facebookCampaignId
        if (!hasConnections) return (
          <div className="bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-amber-700 dark:text-amber-400">
              ⚡ Este funil não tem WhatsApp ou Campanha vinculados — mostrando todos os dados.
            </span>
            <button onClick={() => openEditModal(ws)} className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline">
              Configurar
            </button>
          </div>
        )
        return (
          <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50 px-4 py-1.5 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            {ws.whatsappNickname && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                WhatsApp: <strong className="text-gray-700 dark:text-gray-300">{ws.whatsappNickname}</strong>
              </span>
            )}
            {ws.facebookCampaignName && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Facebook: <strong className="text-gray-700 dark:text-gray-300">{ws.facebookCampaignName}</strong>
              </span>
            )}
            <button onClick={() => openEditModal(ws)} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 transition">
              <Settings2 className="w-3 h-3" />
              Editar funil
            </button>
          </div>
        )
      })()}

      {/* Modal Criar / Editar Workspace */}
      {(showNewModal || showEditId) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {showNewModal ? 'Novo Funil' : 'Editar Funil'}
              </h2>
              <button onClick={() => { setShowNewModal(false); setShowEditId(null) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Emoji + Nome */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Nome do Funil</label>
                <div className="flex gap-2">
                  <select
                    value={form.emoji}
                    onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                    className="w-16 text-center text-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="Ex: Lançamento Produto X"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    maxLength={40}
                  />
                </div>
              </div>

              {/* WhatsApp — só no PRO/Scale */}
              {isProOrScale && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-gray-500 rounded-full" />
                    Número de WhatsApp
                  </label>
                  {loadingOptions ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
                  ) : availableNumbers.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum número conectado ainda.</p>
                  ) : (
                    <select
                      value={form.whatsappIntegrationId}
                      onChange={(e) => setForm({ ...form, whatsappIntegrationId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">— Nenhum (dados globais) —</option>
                      {availableNumbers.map((n) => (
                        <option key={n.id} value={n.id}>{n.nickname} ({n.phoneNumberId})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Bocas do Funil */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  🔺 Bocas do Funil — Fontes de Tráfego
                  <span className="ml-1 font-normal text-gray-400">(selecione 1 ou mais)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'facebook', label: 'Meta / Facebook', color: 'blue', icon: '📘' },
                    { id: 'google',   label: 'Google Ads',       color: 'red',  icon: '🔴' },
                    { id: 'tiktok',   label: 'TikTok Ads',       color: 'gray', icon: '🎵' },
                  ].map(({ id, label, color, icon }) => {
                    const active = form.trafficSources.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleSource(id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          active
                            ? color === 'blue'
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : color === 'red'
                              ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-gray-700 border-gray-700 text-white'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <span>{icon}</span>
                        {label}
                        {active && <span className="ml-1 text-xs opacity-80">✓</span>}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Cada fonte selecionada aparece como uma entrada no topo do seu funil.
                </p>
              </div>

              {/* Checkout Platforms */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  🛍️ Checkout — Plataformas de Venda
                  <span className="ml-1 font-normal text-gray-400">(selecione 1 ou mais)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'hotmart', label: 'Hotmart', color: 'orange', icon: 'H' },
                    { id: 'kiwify', label: 'Kiwify', color: 'emerald', icon: 'K' },
                    { id: 'eduzz', label: 'Eduzz', color: 'purple', icon: 'E' },
                    { id: 'monetizze', label: 'Monetizze', color: 'indigo', icon: 'M' },
                  ].map(({ id, label, color, icon }) => {
                    const active = form.checkoutSources.includes(id)
                    const colorClasses: Record<string, string> = {
                      orange: 'bg-orange-500 border-orange-500 text-white',
                      emerald: 'bg-emerald-500 border-emerald-500 text-white',
                      purple: 'bg-purple-500 border-purple-500 text-white',
                      indigo: 'bg-indigo-500 border-indigo-500 text-white',
                    }
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setForm((f) => {
                          const has = f.checkoutSources.includes(id)
                          const next = has
                            ? f.checkoutSources.filter((s) => s !== id)
                            : [...f.checkoutSources, id]
                          if (next.length === 0) return f
                          return { ...f, checkoutSources: next }
                        })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          active ? colorClasses[color] : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <span className="font-black">{icon}</span>
                        {label}
                        {active && <span className="ml-1 text-xs opacity-80">✓</span>}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Cada plataforma selecionada aparece como card no funil. Remover do visual NÃO para de receber webhooks.
                </p>
              </div>

              {/* Campanha Facebook (só se selecionado) */}
              {form.trafficSources.includes('facebook') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    Campanha do Facebook Ads
                    <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  {loadingOptions ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
                  ) : availableCampaigns.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma campanha. <a href="/facebook-connect" className="text-blue-600 hover:underline">Conectar Facebook Ads</a></p>
                  ) : (
                    <select
                      value={form.facebookCampaignId}
                      onChange={(e) => setForm({ ...form, facebookCampaignId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">— Nenhuma (dados globais) —</option>
                      {availableCampaigns.map((c) => (
                        <option key={c.campaignId} value={c.campaignId}>{c.name} ({c.status})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {planLimitInfo && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-3 space-y-2">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Limite do plano {planLimitInfo.currentPlan || ''} atingido
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {planLimitInfo.message}
                  </p>
                  <a
                    href={planLimitInfo.upgradeUrl}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    Fazer upgrade
                  </a>
                </div>
              )}

              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  {formError}
                </p>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                {showEditId && (
                  <button
                    onClick={() => deleteWorkspace(showEditId)}
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    Remover
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => { setShowNewModal(false); setShowEditId(null); setPlanLimitInfo(null); setFormError('') }}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={showNewModal ? createWorkspace : updateWorkspace}
                    disabled={formLoading}
                    className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {showNewModal ? 'Criar Funil' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
