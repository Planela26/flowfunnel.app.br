'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users, UserPlus, Mail, Trash2, RefreshCw, Shield, Eye, Edit3,
  CheckCircle, Clock, Copy, Check, ArrowLeft
} from 'lucide-react'

interface Member {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  token: string | null
  createdAt: string
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ADMIN: { label: 'Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: Shield },
  EDITOR: { label: 'Editor', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Edit3 },
  VIEWER: { label: 'Visualizador', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', icon: Eye },
}

export default function TeamPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('VIEWER')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status])

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team')
      const data = await res.json()
      setMembers(data.members || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { setError('E-mail obrigatório'); return }
    setInviting(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess('Membro convidado com sucesso!')
      setEmail(''); setName('')
      fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao convidar')
    }
    setInviting(false)
  }

  const changeRole = async (id: string, newRole: string) => {
    await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: newRole }),
    })
    fetchMembers()
  }

  const remove = async (id: string) => {
    if (!confirm('Remover este membro?')) return
    await fetch(`/api/team?id=${id}`, { method: 'DELETE' })
    fetchMembers()
  }

  const copyInviteLink = (token: string, id: string) => {
    const link = `${window.location.origin}/invite?token=${token}`
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (status === 'loading') return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/settings')} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Gerenciar Time
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Convide membros para acessar seu painel</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Convidar novo membro
          </h2>
          <form onSubmit={invite} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome (opcional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome do membro"
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Permissão</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 text-sm text-gray-900 bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="VIEWER">Visualizador — só ver dados</option>
                <option value="EDITOR">Editor — editar campanhas e metas</option>
                <option value="ADMIN">Admin — acesso total</option>
              </select>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {success && <p className="text-green-600 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {success}</p>}

            <button
              type="submit"
              disabled={inviting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {inviting ? 'Convidando...' : 'Enviar convite'}
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Membros do time ({members.length})</h2>
            <button onClick={fetchMembers} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Users className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum membro ainda</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Convide alguém para colaborar no seu painel.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {members.map(member => {
                const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.VIEWER
                const RoleIcon = roleCfg.icon
                return (
                  <li key={member.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                          {(member.name || member.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {member.name || <span className="text-gray-400 italic">Sem nome</span>}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleCfg.color}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleCfg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                        {member.status === 'ACTIVE' ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <Clock className="w-3 h-3 inline mr-1" />}
                        {member.status === 'ACTIVE' ? 'Ativo' : 'Pendente'}
                      </span>
                      {member.token && (
                        <button
                          onClick={() => copyInviteLink(member.token!, member.id)}
                          className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                          title="Copiar link de convite"
                        >
                          {copiedId === member.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                        </button>
                      )}
                      <select
                        value={member.role}
                        onChange={e => changeRole(member.id, e.target.value)}
                        className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border-none rounded-lg px-2 py-1 focus:outline-none"
                      >
                        <option value="VIEWER">Visualizador</option>
                        <option value="EDITOR">Editor</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button
                        onClick={() => remove(member.id)}
                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                        title="Remover membro"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
          Membros convidados recebem um link de acesso com as permissões configuradas.
        </p>
      </div>
    </div>
  )
}
