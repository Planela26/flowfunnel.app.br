'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, RefreshCw, ChevronRight, ChevronLeft, Trash2,
  Phone, Mail, StickyNote, CheckCircle, AlertCircle,
  Plus, UserPlus
} from 'lucide-react'

interface LeadStatusItem {
  id: string
  phone: string
  name: string | null
  email: string | null
  stage: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

const STAGES = [
  { key: 'NOVO', label: 'Novo', color: 'border-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { key: 'QUALIFICADO', label: 'Qualificado', color: 'border-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  { key: 'PROPOSTA', label: 'Proposta', color: 'border-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  { key: 'GANHO', label: 'Ganho', color: 'border-green-400', bg: 'bg-green-50 dark:bg-green-900/20', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { key: 'PERDIDO', label: 'Perdido', color: 'border-red-400', bg: 'bg-red-50 dark:bg-red-900/20', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
]

const STAGE_KEYS = STAGES.map(s => s.key)

interface AddLeadFormProps {
  onAdded: () => void
}

function AddLeadForm({ onAdded }: AddLeadFormProps) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState('NOVO')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!phone) { setError('Telefone obrigatório'); return }
    setSaving(true)
    await fetch('/api/leads/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name, email, stage }),
    })
    setSaving(false)
    setPhone(''); setName(''); setEmail(''); setStage('NOVO'); setOpen(false)
    onAdded()
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
    >
      <UserPlus className="w-4 h-4" />
      Adicionar lead ao CRM
    </button>
  )

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Novo lead no CRM</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input type="text" placeholder="Telefone *" value={phone} onChange={e => setPhone(e.target.value)}
          className="px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400" />
        <input type="text" placeholder="Nome" value={name} onChange={e => setName(e.target.value)}
          className="px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400" />
        <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)}
          className="px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400" />
        <select value={stage} onChange={e => setStage(e.target.value)}
          className="px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
          {saving ? 'Salvando...' : 'Adicionar'}
        </button>
        <button onClick={() => setOpen(false)}
          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function LeadKanban() {
  const [leads, setLeads] = useState<LeadStatusItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editNote, setEditNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads/status')
      const data = await res.json()
      setLeads(data.statuses || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const moveStage = async (phone: string, direction: 'next' | 'prev', currentStage: string) => {
    const currentIndex = STAGE_KEYS.indexOf(currentStage)
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
    if (newIndex < 0 || newIndex >= STAGE_KEYS.length) return

    const newStage = STAGE_KEYS[newIndex]
    setLeads(prev => prev.map(l => l.phone === phone ? { ...l, stage: newStage } : l))

    await fetch('/api/leads/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, stage: newStage }),
    })
  }

  const saveNote = async (phone: string) => {
    setSavingNote(true)
    await fetch('/api/leads/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, stage: leads.find(l => l.phone === phone)?.stage, notes: noteText }),
    })
    setLeads(prev => prev.map(l => l.phone === phone ? { ...l, notes: noteText } : l))
    setEditNote(null)
    setSavingNote(false)
  }

  const remove = async (phone: string) => {
    if (!confirm('Remover este lead do CRM?')) return
    setLeads(prev => prev.filter(l => l.phone !== phone))
    await fetch(`/api/leads/status?phone=${encodeURIComponent(phone)}`, { method: 'DELETE' })
  }

  const groupedByStage = STAGE_KEYS.reduce((acc, key) => {
    acc[key] = leads.filter(l => l.stage === key)
    return acc
  }, {} as Record<string, LeadStatusItem[]>)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <AddLeadForm onAdded={fetchLeads} />
        <button onClick={fetchLeads} className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum lead no CRM ainda</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Use o botão acima para adicionar leads manualmente ou eles entrarão automaticamente via webhooks.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STAGES.map(stage => {
              const stageLeads = groupedByStage[stage.key] || []
              const stageIndex = STAGE_KEYS.indexOf(stage.key)
              return (
                <div key={stage.key} className={`w-64 flex-shrink-0 rounded-2xl border-t-4 ${stage.color} bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex flex-col`}>
                  <div className={`flex items-center justify-between px-4 py-3 ${stage.bg} rounded-t-xl`}>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${stage.badge}`}>{stage.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{stageLeads.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[60vh] p-2 space-y-2">
                    {stageLeads.length === 0 && (
                      <div className="text-center py-8 text-gray-300 dark:text-gray-600 text-xs">Nenhum lead aqui</div>
                    )}
                    {stageLeads.map(lead => (
                      <div key={lead.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 hover:shadow-sm transition">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-medium text-gray-900 dark:text-white text-sm leading-tight">
                            {lead.name || <span className="text-gray-400 italic text-xs">Sem nome</span>}
                          </div>
                          <button onClick={() => remove(lead.phone)} className="ml-1 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition flex-shrink-0">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                            <Mail className="w-3 h-3" /> {lead.email}
                          </div>
                        )}

                        {editNote === lead.phone ? (
                          <div className="mt-2">
                            <textarea
                              rows={2}
                              value={noteText}
                              onChange={e => setNoteText(e.target.value)}
                              className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                              placeholder="Adicionar nota..."
                            />
                            <div className="flex gap-1 mt-1">
                              <button onClick={() => saveNote(lead.phone)} disabled={savingNote}
                                className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                                {savingNote ? '...' : 'Salvar'}
                              </button>
                              <button onClick={() => setEditNote(null)}
                                className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            {lead.notes ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1 mb-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                onClick={() => { setEditNote(lead.phone); setNoteText(lead.notes || '') }}>
                                <StickyNote className="w-3 h-3 inline mr-1" />
                                {lead.notes}
                              </div>
                            ) : (
                              <button onClick={() => { setEditNote(lead.phone); setNoteText('') }}
                                className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 transition flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Adicionar nota
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3">
                          <button
                            onClick={() => moveStage(lead.phone, 'prev', lead.stage)}
                            disabled={stageIndex === 0}
                            className="p-1 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30 transition"
                            title="Voltar estágio"
                          >
                            <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                          </button>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(lead.updatedAt).toLocaleDateString('pt-BR')}
                          </span>
                          <button
                            onClick={() => moveStage(lead.phone, 'next', lead.stage)}
                            disabled={stageIndex === STAGE_KEYS.length - 1}
                            className="p-1 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-30 transition"
                            title="Avançar estágio"
                          >
                            <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
