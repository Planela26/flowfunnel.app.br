'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  SlidersHorizontal, KeyRound, Mail, Trash2, Loader2,
  ShieldCheck, ArrowRight, CreditCard, User,
} from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'
import SubscriptionCard from '@/components/SubscriptionCard'
import ThemeToggle from '@/components/ThemeToggle'

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 px-1">
      {children}
    </h2>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {children}
    </div>
  )
}

function Msg({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  return (
    <p className={`text-sm mt-1 ${msg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {msg.text}
    </p>
  )
}

export default function ConfiguracoesPage() {
  const { data: session, update } = useSession()

  // ── Senha ────────────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pwdLoading, setPwdLoading] = useState(false)

  const handlePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdMsg(null)
    if (pwd.next !== pwd.confirm) { setPwdMsg({ type: 'err', text: 'Confirmação não confere' }); return }
    setPwdLoading(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setPwdMsg({ type: 'ok', text: 'Senha alterada com sucesso!' })
      setPwd({ current: '', next: '', confirm: '' })
    } catch (err: any) {
      setPwdMsg({ type: 'err', text: err.message })
    } finally {
      setPwdLoading(false)
    }
  }

  // ── Email ────────────────────────────────────────────────────────────────
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' })
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailMsg(null)
    setEmailLoading(true)
    try {
      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setEmailMsg({ type: 'ok', text: 'Email alterado! Redirecionando para login…' })
      setEmailForm({ newEmail: '', currentPassword: '' })
      await update()
      setTimeout(() => signOut({ callbackUrl: '/login' }), 1500)
    } catch (err: any) {
      setEmailMsg({ type: 'err', text: err.message })
    } finally {
      setEmailLoading(false)
    }
  }

  // ── Deletar conta ────────────────────────────────────────────────────────
  const [delForm, setDelForm] = useState({ confirm: '', currentPassword: '', confirmEmail: '' })
  const [delMsg, setDelMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [delLoading, setDelLoading] = useState(false)
  const [showDeleteSection, setShowDeleteSection] = useState(false)

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    setDelMsg(null)
    if (!confirm('Tem certeza? Esta ação é irreversível.')) return
    setDelLoading(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setDelMsg({ type: 'ok', text: 'Conta deletada. Você será desconectado.' })
      setTimeout(() => signOut({ callbackUrl: '/' }), 1500)
    } catch (err: any) {
      setDelMsg({ type: 'err', text: err.message })
    } finally {
      setDelLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <DashboardSidebar />
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">

          {/* ── Header ── */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <SlidersHorizontal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Configurações</h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Dados da conta, senha, segurança e assinatura.
              </p>
            </div>
            <ThemeToggle />
          </div>

          {/* ── Assinatura ── */}
          <div className="mb-6">
            <SectionLabel>Assinatura</SectionLabel>
            <SubscriptionCard />
          </div>

          {/* ── Perfil / Dados pessoais ── */}
          <div className="mb-6">
            <SectionLabel>Dados pessoais</SectionLabel>
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {session?.user?.name || 'Usuário'}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{session?.user?.email}</span>
              </div>

              {/* Alterar senha */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-5 mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Alterar senha</span>
                </div>
                <form onSubmit={handlePwd} className="space-y-3">
                  <input
                    type="password"
                    placeholder="Senha atual"
                    value={pwd.current}
                    onChange={e => setPwd({ ...pwd, current: e.target.value })}
                    className={inputCls}
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="password"
                      placeholder="Nova senha (mín. 8)"
                      value={pwd.next}
                      onChange={e => setPwd({ ...pwd, next: e.target.value })}
                      className={inputCls}
                      minLength={8}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Confirme a nova senha"
                      value={pwd.confirm}
                      onChange={e => setPwd({ ...pwd, confirm: e.target.value })}
                      className={inputCls}
                      minLength={8}
                      required
                    />
                  </div>
                  <Msg msg={pwdMsg} />
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2 transition"
                  >
                    {pwdLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Salvar nova senha
                  </button>
                </form>
              </div>

              {/* Alterar email */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Alterar email</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Email atual: <strong>{session?.user?.email}</strong>
                </p>
                <form onSubmit={handleEmail} className="space-y-3">
                  <input
                    type="email"
                    placeholder="Novo email"
                    value={emailForm.newEmail}
                    onChange={e => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                    className={inputCls}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Senha atual (para confirmar)"
                    value={emailForm.currentPassword}
                    onChange={e => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                    className={inputCls}
                  />
                  <Msg msg={emailMsg} />
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2 transition"
                  >
                    {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Alterar email
                  </button>
                </form>
              </div>
            </Card>
          </div>

          {/* ── Segurança ── */}
          <div className="mb-6">
            <SectionLabel>Segurança</SectionLabel>
            <Link
              href="/settings/security"
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Verificação em duas etapas (2FA)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Configure o autenticador e os códigos de recuperação</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition" />
            </Link>
          </div>

          {/* ── Assinatura / Pagamento (link) ── */}
          <div className="mb-6">
            <SectionLabel>Pagamento</SectionLabel>
            <Link
              href="/billing"
              className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Gerenciar plano e faturamento</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Histórico de pagamentos, upgrade e cancelamento</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition" />
            </Link>
          </div>

          {/* ── Zona de perigo ── */}
          <div className="mb-6">
            <SectionLabel>Zona de perigo</SectionLabel>
            <Card className="border-red-200 dark:border-red-900/50">
              <button
                onClick={() => setShowDeleteSection(!showDeleteSection)}
                className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:underline"
              >
                <Trash2 className="w-4 h-4" />
                Deletar minha conta
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Esta ação é permanente. Todos os dados (funis, integrações, histórico) serão excluídos.
              </p>

              {showDeleteSection && (
                <form onSubmit={handleDelete} className="mt-5 space-y-3 border-t border-red-100 dark:border-red-900/40 pt-5">
                  <input
                    type="text"
                    placeholder='Digite "DELETAR" para confirmar'
                    value={delForm.confirm}
                    onChange={e => setDelForm({ ...delForm, confirm: e.target.value })}
                    className={inputCls}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Senha atual (contas com senha)"
                    value={delForm.currentPassword}
                    onChange={e => setDelForm({ ...delForm, currentPassword: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    type="email"
                    placeholder="E-mail da conta (login social)"
                    value={delForm.confirmEmail}
                    onChange={e => setDelForm({ ...delForm, confirmEmail: e.target.value })}
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400">
                    Conta com senha: informe a senha. Login pelo Google: informe o e-mail.
                  </p>
                  <Msg msg={delMsg} />
                  <button
                    type="submit"
                    disabled={delLoading || delForm.confirm !== 'DELETAR'}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2 transition"
                  >
                    {delLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Deletar conta permanentemente
                  </button>
                </form>
              )}
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
