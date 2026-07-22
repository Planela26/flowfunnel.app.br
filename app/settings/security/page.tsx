'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, ShieldCheck, ShieldOff, Loader2, Copy, Check,
  KeyRound, RefreshCw, AlertTriangle,
} from 'lucide-react'

type Status = {
  enabled: boolean
  activatedAt: string | null
  recoveryCodesRemaining: number
  required: boolean
  hasPassword: boolean
}

export default function SecurityPage() {
  const { update } = useSession()
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)

  // Setup state
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string; qrDataUrl: string } | null>(null)
  const [setupCode, setSetupCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)

  // Recovery codes (mostrados uma vez)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  // Disable / regenerate
  const [disablePassword, setDisablePassword] = useState('')
  const [regenPassword, setRegenPassword] = useState('')
  const [showDisable, setShowDisable] = useState(false)
  const [showRegen, setShowRegen] = useState(false)

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/account/2fa/status')
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const startSetup = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/account/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao iniciar configuração')
        return
      }
      setSetup(data)
    } catch {
      setError('Erro ao iniciar configuração')
    } finally {
      setBusy(false)
    }
  }

  const activate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/account/2fa/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: setupCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Código inválido')
        return
      }
      setRecoveryCodes(data.recoveryCodes)
      setSetup(null)
      setSetupCode('')
      await update()
      await loadStatus()
    } catch {
      setError('Erro ao ativar 2FA')
    } finally {
      setBusy(false)
    }
  }

  const disable = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/account/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: disablePassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao desativar')
        return
      }
      setDisablePassword('')
      setShowDisable(false)
      setRecoveryCodes(null)
      await update()
      await loadStatus()
    } catch {
      setError('Erro ao desativar 2FA')
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/account/2fa/recovery-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: regenPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao regenerar')
        return
      }
      setRecoveryCodes(data.recoveryCodes)
      setRegenPassword('')
      setShowRegen(false)
      await loadStatus()
    } catch {
      setError('Erro ao regenerar códigos')
    } finally {
      setBusy(false)
    }
  }

  const copySecret = () => {
    if (!setup) return
    navigator.clipboard.writeText(setup.secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  const downloadCodes = () => {
    if (!recoveryCodes) return
    const blob = new Blob(
      [`Códigos de recuperação — FlowFunnel\n\n${recoveryCodes.join('\n')}\n\nGuarde em local seguro. Cada código só pode ser usado uma vez.`],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flowfunnel-codigos-recuperacao.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/account" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar à conta
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Segurança</h1>
        <p className="text-gray-500 mb-8">
          Adicione uma camada extra de proteção com a verificação em duas etapas (2FA).
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Códigos de recuperação recém gerados — mostrados UMA vez */}
        {recoveryCodes && (
          <section className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Guarde seus códigos de recuperação
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Cada código pode ser usado <strong>uma única vez</strong> para entrar caso você perca
              acesso ao app autenticador. Eles <strong>não serão mostrados novamente</strong>.
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-white dark:bg-gray-900 rounded-lg p-4 mb-4">
              {recoveryCodes.map((c) => (
                <div key={c} className="text-gray-900 dark:text-white tracking-wider">{c}</div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={downloadCodes}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
              >
                Baixar códigos
              </button>
              <button
                onClick={() => setRecoveryCodes(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium"
              >
                Já guardei
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : status?.enabled ? (
          /* ───────── 2FA ATIVO ───────── */
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">2FA ativo</h2>
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                Protegido
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Sua conta exige um código do app autenticador a cada login. Você tem{' '}
              <strong>{status.recoveryCodesRemaining}</strong> código(s) de recuperação restante(s).
            </p>

            {/* Regenerar códigos */}
            {showRegen ? (
              <form onSubmit={regenerate} className="space-y-3 mb-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Gerar novos códigos invalida todos os anteriores. Confirme sua senha:
                </p>
                <input
                  type="password"
                  placeholder="Senha atual"
                  value={regenPassword}
                  onChange={(e) => setRegenPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />} Gerar novos códigos
                  </button>
                  <button type="button" onClick={() => { setShowRegen(false); setRegenPassword(''); setError('') }} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm">
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => { setShowRegen(true); setShowDisable(false); setError('') }}
                disabled={!status.hasPassword}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mb-4 disabled:opacity-50 disabled:no-underline"
              >
                <RefreshCw className="w-4 h-4" /> Gerar novos códigos de recuperação
              </button>
            )}

            {/* Desativar */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              {status.required && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Sua conta tem permissões administrativas — o 2FA é obrigatório e não pode ser desativado.
                </p>
              )}
              {showDisable ? (
                <form onSubmit={disable} className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Confirme sua senha para desativar o 2FA:</p>
                  <input
                    type="password"
                    placeholder="Senha atual"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                      {busy && <Loader2 className="w-4 h-4 animate-spin" />} Desativar 2FA
                    </button>
                    <button type="button" onClick={() => { setShowDisable(false); setDisablePassword(''); setError('') }} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => { setShowDisable(true); setShowRegen(false); setError('') }}
                  disabled={status.required || !status.hasPassword}
                  className="inline-flex items-center gap-2 text-sm text-red-600 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                >
                  <ShieldOff className="w-4 h-4" /> Desativar 2FA
                </button>
              )}
            </div>
          </section>
        ) : setup ? (
          /* ───────── SETUP EM ANDAMENTO ───────── */
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Escaneie o QR Code
            </h2>
            <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mb-4 list-decimal list-inside">
              <li>Abra o Google Authenticator, Microsoft Authenticator ou Authy.</li>
              <li>Toque em &quot;+&quot; e escaneie o código abaixo.</li>
              <li>Digite o código de 6 dígitos gerado para confirmar.</li>
            </ol>

            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qrDataUrl} alt="QR Code 2FA" width={200} height={200} className="rounded-lg border border-gray-200 dark:border-gray-700" />
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Não consegue escanear? Insira o código manualmente:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm break-all text-gray-900 dark:text-white">
                  {setup.secret}
                </code>
                <button onClick={copySecret} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-blue-600">
                  {copiedSecret ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <form onSubmit={activate} className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Código de 6 dígitos"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                className="w-full px-3 py-2 text-center tracking-[0.3em] border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Ativar 2FA
                </button>
                <button type="button" onClick={() => { setSetup(null); setSetupCode(''); setError('') }} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        ) : (
          /* ───────── 2FA INATIVO ───────── */
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Verificação em duas etapas
              </h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Use um app autenticador (Google Authenticator, Microsoft Authenticator ou Authy) para
              gerar códigos temporários a cada login.
            </p>
            {status?.required && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Obrigatório para sua conta (permissões administrativas).
              </p>
            )}
            {!status?.hasPassword ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Sua conta usa login do Google. Defina uma senha na página &quot;Minha conta&quot; antes de ativar o 2FA.
              </p>
            ) : (
              <button
                onClick={startSetup}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                <ShieldCheck className="w-4 h-4" /> Ativar 2FA
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
