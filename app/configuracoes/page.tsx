'use client'

import { useState, useEffect } from 'react'
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

  // ── Email (2 passos: form → popup com código) ───────────────────────────
  const [emailStep, setEmailStep] = useState<'form' | 'code'>('form')
  const [emailForm, setEmailForm] = useState({
    currentEmail: '',   // usuário digita o próprio email atual (sem sugestão) para confirmar
    newEmail: '',
    currentPassword: '',
    code: '',
  })
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailCodeMsg, setEmailCodeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [codeResendIn, setCodeResendIn] = useState(0)

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailMsg(null)
    // Validação frontend: email atual digitado precisa bater com o da sessão
    if (emailForm.currentEmail.trim().toLowerCase() !== (session?.user?.email ?? '').toLowerCase()) {
      setEmailMsg({ type: 'err', text: 'O email atual digitado não corresponde ao da sua conta.' })
      return
    }
    setEmailLoading(true)
    try {
      const res = await fetch('/api/account/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailForm.newEmail, currentPassword: emailForm.currentPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setEmailMsg(null)
      setEmailCodeMsg({ type: 'ok', text: `Código enviado para ${data.sentTo}. Confira a caixa de entrada e o spam.` })
      setEmailStep('code')
      setCodeResendIn(60)
    } catch (err: any) {
      setEmailMsg({ type: 'err', text: err.message })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailCodeMsg(null)
    setEmailLoading(true)
    try {
      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: emailForm.newEmail,
          code: emailForm.code,
          currentPassword: emailForm.currentPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setEmailCodeMsg({ type: 'ok', text: 'Email alterado! Redirecionando para login…' })
      await update()
      setTimeout(() => signOut({ callbackUrl: '/login' }), 1500)
    } catch (err: any) {
      setEmailCodeMsg({ type: 'err', text: err.message })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (codeResendIn > 0) return
    setEmailCodeMsg(null)
    setEmailLoading(true)
    try {
      const res = await fetch('/api/account/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailForm.newEmail, currentPassword: emailForm.currentPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setEmailCodeMsg({ type: 'ok', text: `Novo código enviado para ${data.sentTo}.` })
      setCodeResendIn(60)
    } catch (err: any) {
      setEmailCodeMsg({ type: 'err', text: err.message })
    } finally {
      setEmailLoading(false)
    }
  }

  const cancelEmailChange = () => {
    setEmailForm({ currentEmail: '', newEmail: '', currentPassword: '', code: '' })
    setEmailMsg(null)
    setEmailCodeMsg(null)
    setEmailStep('form')
    setCodeResendIn(0)
  }

  // countdown do reenvio
  useEffect(() => {
    if (codeResendIn <= 0 || emailStep !== 'code') return
    const t = setTimeout(() => setCodeResendIn(s => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(t)
  }, [codeResendIn, emailStep])

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

                <form onSubmit={handleRequestEmailChange} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Email atual
                    </label>
                    <input
                      type="email"
                      placeholder="Digite seu email atual"
                      value={emailForm.currentEmail}
                      onChange={e => setEmailForm({ ...emailForm, currentEmail: e.target.value })}
                      className={inputCls}
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Novo email
                    </label>
                    <input
                      type="email"
                      placeholder="Digite o novo email"
                      value={emailForm.newEmail}
                      onChange={e => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                      className={inputCls}
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Senha atual
                    </label>
                    <input
                      type="password"
                      placeholder="Digite sua senha atual"
                      value={emailForm.currentPassword}
                      onChange={e => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                      className={inputCls}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Msg msg={emailMsg} />
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2 transition"
                  >
                    {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Solicitar troca de email
                  </button>
                </form>

                {/* ── Modal popup do código ── */}
                {emailStep === 'code' && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                      onClick={cancelEmailChange}
                    />
                    {/* Dialog */}
                    <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 animate-in fade-in zoom-in-95 duration-200">
                      {/* Fechar */}
                      <button
                        type="button"
                        onClick={cancelEmailChange}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                        aria-label="Fechar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>

                      <div className="mb-5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-4">
                          <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                          Confirme a troca de email
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                          Enviamos um código de <strong className="text-gray-700 dark:text-gray-300">6 dígitos</strong> para{' '}
                          <strong className="text-gray-700 dark:text-gray-300">{session?.user?.email}</strong>.
                          <br />Cole-o abaixo para confirmar a troca para{' '}
                          <strong className="text-gray-700 dark:text-gray-300">{emailForm.newEmail}</strong>.
                        </p>
                      </div>

                      <form onSubmit={handleConfirmEmailChange} className="space-y-4">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                          value={emailForm.code}
                          onChange={e =>
                            setEmailForm({ ...emailForm, code: e.target.value.replace(/\D/g, '').slice(0, 6) })
                          }
                          className={`${inputCls} text-center text-3xl tracking-[0.6em] font-mono font-bold py-4`}
                          autoFocus
                          required
                        />
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                          O código expira em 15 minutos.
                        </p>

                        {emailCodeMsg && (
                          <p className={`text-sm text-center ${emailCodeMsg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {emailCodeMsg.text}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={emailLoading || emailForm.code.length !== 6}
                          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2 transition"
                        >
                          {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Enviar código
                        </button>

                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs text-gray-400 dark:text-gray-500">Não recebeu?</span>
                          <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={emailLoading || codeResendIn > 0}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline transition"
                          >
                            {codeResendIn > 0 ? `Reenviar em ${codeResendIn}s` : 'Reenviar código'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
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
