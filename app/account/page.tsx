'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, KeyRound, Mail, Trash2, Loader2, ShieldCheck } from 'lucide-react'

export default function AccountPage() {
  const { data: session, status, update } = useSession()
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pwdLoading, setPwdLoading] = useState(false)

  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' })
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  const [delForm, setDelForm] = useState({ confirm: '', currentPassword: '', confirmEmail: '' })
  const [delMsg, setDelMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [delLoading, setDelLoading] = useState(false)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  const handlePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdMsg(null)
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: 'err', text: 'Confirmação não confere' })
      return
    }
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
      setEmailMsg({ type: 'ok', text: 'Email alterado! Faça login novamente.' })
      setEmailForm({ newEmail: '', currentPassword: '' })
      await update()
      setTimeout(() => signOut({ callbackUrl: '/login' }), 1500)
    } catch (err: any) {
      setEmailMsg({ type: 'err', text: err.message })
    } finally {
      setEmailLoading(false)
    }
  }

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Minha conta</h1>
        <p className="text-gray-500 mb-8">Gerencie sua senha, email e dados pessoais.</p>

        {/* Segurança / 2FA */}
        <Link
          href="/settings/security"
          className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6 hover:border-blue-300 dark:hover:border-blue-700 transition group"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Segurança e 2FA</h2>
              <p className="text-sm text-gray-500">Verificação em duas etapas e códigos de recuperação.</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition" />
        </Link>

        {/* Trocar senha */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alterar senha</h2>
          </div>
          <form onSubmit={handlePwd} className="space-y-3">
            <input
              type="password"
              placeholder="Senha atual"
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
            />
            <input
              type="password"
              placeholder="Nova senha (mín. 8 caracteres)"
              value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              minLength={8}
              required
            />
            <input
              type="password"
              placeholder="Confirme a nova senha"
              value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              minLength={8}
              required
            />
            {pwdMsg && (
              <p className={`text-sm ${pwdMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg.text}</p>
            )}
            <button
              type="submit"
              disabled={pwdLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {pwdLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Alterar senha
            </button>
          </form>
        </section>

        {/* Trocar email */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alterar email</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">Email atual: <strong>{session.user.email}</strong></p>
          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              placeholder="Novo email"
              value={emailForm.newEmail}
              onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
            />
            <input
              type="password"
              placeholder="Senha atual (para confirmar)"
              value={emailForm.currentPassword}
              onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            {emailMsg && (
              <p className={`text-sm ${emailMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{emailMsg.text}</p>
            )}
            <button
              type="submit"
              disabled={emailLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Alterar email
            </button>
          </form>
        </section>

        {/* Deletar conta */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Deletar conta</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Esta ação é <strong>permanente</strong>. Todos os seus dados (funis, integrações, notificações) serão excluídos.
          </p>
          <form onSubmit={handleDelete} className="space-y-3">
            <input
              type="text"
              placeholder='Digite "DELETAR" para confirmar'
              value={delForm.confirm}
              onChange={(e) => setDelForm({ ...delForm, confirm: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
            />
            <input
              type="password"
              placeholder="Senha atual (contas com senha)"
              value={delForm.currentPassword}
              onChange={(e) => setDelForm({ ...delForm, currentPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <input
              type="email"
              placeholder="E-mail da conta (login social)"
              value={delForm.confirmEmail}
              onChange={(e) => setDelForm({ ...delForm, confirmEmail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Conta com senha: informe a senha. Login do Google: digite o e-mail da conta para confirmar.
            </p>
            {delMsg && (
              <p className={`text-sm ${delMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{delMsg.text}</p>
            )}
            <button
              type="submit"
              disabled={delLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {delLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Deletar conta permanentemente
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
