'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageCircle, Settings, Database, Bell, Link as LinkIcon,
  Save, Check, Facebook, ShoppingCart, ExternalLink,
  ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import SubscriptionCard from '@/components/SubscriptionCard'
import {
  ALERT_RULES,
  DEFAULT_ALERT_SETTINGS,
  type AlertRuleKey,
  type AlertSettings,
} from '@/lib/alertSettings'

// ─── Integration panel for one platform ─────────────────────────────────────
function IntegrationPanel({
  icon,
  label,
  color,
  connected,
  tutorialHref,
  children,
}: {
  icon: React.ReactNode
  label: string
  color: string
  connected: boolean
  tutorialHref: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-colors ${
      connected
        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      {/* Header row */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            {icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">{label}</span>
              {connected ? (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Conectado
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                  Não conectado
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {connected ? 'Credenciais salvas — clique para gerenciar' : 'Insira as credenciais abaixo para conectar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={tutorialHref}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Tutorial
          </Link>
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t dark:border-gray-700 px-4 py-4 bg-white dark:bg-gray-800">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Inline status badge ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'idle' | 'saving' | 'ok' | 'error' }) {
  if (status === 'idle') return null
  if (status === 'saving') return (
    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
      <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
    </span>
  )
  if (status === 'ok') return (
    <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
      <CheckCircle className="w-3 h-3" /> Salvo!
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
      <XCircle className="w-3 h-3" /> Erro ao salvar
    </span>
  )
  return null
}

// ─── Shared input className ───────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500'
const inputMonoCls = inputCls + ' font-mono'

// ─── Main settings page ───────────────────────────────────────────────────────
export default function ConfigPage() {
  const [saved, setSaved] = useState(false)
  const [integrations, setIntegrations] = useState({ facebook: false, whatsapp: false, hotmart: false, eduzz: false, monetizze: false, kiwify: false, google: false, tiktok: false })
  const [fbStatus, setFbStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [waStatus, setWaStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [hmStatus, setHmStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [ezStatus, setEzStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [mzStatus, setMzStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [kwStatus, setKwStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [ggStatus, setGgStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [ttStatus, setTtStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [fbCreds, setFbCreds] = useState({ accessToken: '', adAccountId: '', appId: '', appSecret: '' })
  const [waCreds, setWaCreds] = useState({ accessToken: '', phoneNumberId: '', businessAccountId: '' })
  const [hmCreds, setHmCreds] = useState({ hotmartId: '', email: '', webhookToken: '' })
  const [ezCreds, setEzCreds] = useState({ email: '', publicKey: '' })
  const [mzCreds, setMzCreds] = useState({ email: '', apiKey: '' })
  const [kwCreds, setKwCreds] = useState({ storeId: '', secretKey: '' })
  const [ggCreds, setGgCreds] = useState({ customerId: '', developerToken: '', clientId: '', clientSecret: '', refreshToken: '' })
  const [ttCreds, setTtCreds] = useState({ appId: '', secret: '', advertiserId: '', accessToken: '' })
  const [loadingIntegrations, setLoadingIntegrations] = useState(true)
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS)
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [alertPlan, setAlertPlan] = useState<string>('FREE')
  const [alertStatus, setAlertStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [config, setConfig] = useState({
    metaVendas: 100,
    metaFaturamento: 15000,
    metaLeads: 500,
    alertaCPCAlto: 3.00,
    alertaTaxaConversaoBaixa: 5,
    alertaCheckoutAbandonado: 30,
    custoProduto: 50,
    emailAlertas: true,
    whatsappAlertas: false,
  })

  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const [fbRes, waRes, hmRes, ezRes, mzRes, kwRes] = await Promise.all([
          fetch('/api/integrations/meta'),
          fetch('/api/integrations/whatsapp'),
          fetch('/api/integrations/hotmart'),
          fetch('/api/integrations/eduzz'),
          fetch('/api/integrations/monetizze'),
          fetch('/api/integrations/kiwify'),
        ])
        const [fbData, waData, hmData, ezData, mzData, kwData] = await Promise.all([
          fbRes.json(), waRes.json(), hmRes.json(), ezRes.json(), mzRes.json(), kwRes.json(),
        ])
        setIntegrations(prev => ({
          ...prev,
          facebook:  fbData?.connected ?? false,
          whatsapp:  waData?.connected ?? false,
          hotmart:   hmData?.connected ?? false,
          eduzz:     ezData?.connected ?? false,
          monetizze: mzData?.connected ?? false,
          kiwify:    kwData?.connected ?? false,
        }))
      } catch (err) {
        console.error('Erro ao verificar integrações:', err)
      } finally {
        setLoadingIntegrations(false)
      }
    }
    checkIntegrations()
  }, [])

  useEffect(() => {
    const loadAlertSettings = async () => {
      try {
        const res = await fetch('/api/account/alert-settings')
        if (!res.ok) return
        const data = await res.json()
        if (data?.settings) setAlertSettings(data.settings)
        setAlertEnabled(Boolean(data?.enabled))
        setAlertPlan(String(data?.plan || 'FREE'))
      } catch (err) {
        console.error('Erro ao carregar alertas:', err)
      }
    }
    loadAlertSettings()
  }, [])

  const toggleAlertRule = async (key: AlertRuleKey, value: boolean) => {
    const next = { ...alertSettings, [key]: value }
    setAlertSettings(next)
    setAlertStatus('saving')
    try {
      const res = await fetch('/api/account/alert-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error('API error')
      setAlertStatus('ok')
      setTimeout(() => setAlertStatus('idle'), 2000)
    } catch {
      setAlertStatus('error')
      setTimeout(() => setAlertStatus('idle'), 3000)
    }
  }

  const saveIntegration = async (
    url: string,
    body: Record<string, string>,
    setStatus: (s: 'idle' | 'saving' | 'ok' | 'error') => void,
    onSuccess?: () => void,
  ) => {
    setStatus('saving')
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('API error')
      setStatus('ok')
      onSuccess?.()
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  const saveFacebook = () =>
    saveIntegration('/api/integrations/meta', {
      accessToken: fbCreds.accessToken,
      adAccountId: fbCreds.adAccountId.replace('act_', ''),
      appId: fbCreds.appId,
      appSecret: fbCreds.appSecret,
    }, setFbStatus, () => setIntegrations(i => ({ ...i, facebook: true })))

  const saveWhatsApp = () =>
    saveIntegration('/api/integrations/whatsapp', {
      accessToken: waCreds.accessToken,
      phoneNumberId: waCreds.phoneNumberId,
      businessAccountId: waCreds.businessAccountId,
    }, setWaStatus, () => setIntegrations(i => ({ ...i, whatsapp: true })))

  const saveHotmart = () =>
    saveIntegration('/api/integrations/hotmart', {
      hotmartId: hmCreds.hotmartId,
      email: hmCreds.email,
      webhookToken: hmCreds.webhookToken,
    }, setHmStatus, () => setIntegrations(i => ({ ...i, hotmart: true })))

  const saveEduzz = () =>
    saveIntegration('/api/integrations/eduzz', {
      email: ezCreds.email,
      publicKey: ezCreds.publicKey,
    }, setEzStatus, () => setIntegrations(i => ({ ...i, eduzz: true })))

  const saveMonetizze = () =>
    saveIntegration('/api/integrations/monetizze', {
      email: mzCreds.email,
      apiKey: mzCreds.apiKey,
    }, setMzStatus, () => setIntegrations(i => ({ ...i, monetizze: true })))

  const saveKiwify = () =>
    saveIntegration('/api/integrations/kiwify', {
      storeId: kwCreds.storeId,
      secretKey: kwCreds.secretKey,
    }, setKwStatus, () => setIntegrations(i => ({ ...i, kiwify: true })))

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 transition-colors">
        <div className="container mx-auto px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm flex-shrink-0">
                <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-lg font-extrabold text-blue-900 dark:text-white tracking-tight leading-none">FlowFunnel</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-none mt-0.5">Integrações</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                ← Dashboard
              </Link>
              <Link href="/analytics" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition">
                📊 Analytics
              </Link>
              <Link href="/test-integrations" className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition">
                🧪 Testes
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">

        {/* ── Assinatura ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <SubscriptionCard />
        </div>

        {/* ── Integrations ──────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6 transition-colors">
          <div className="flex items-center gap-2 mb-5">
            <LinkIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Integrações</h2>
            <span className="text-sm text-gray-400 dark:text-gray-500 ml-1">— insira as credenciais e clique em Salvar</span>
          </div>

          {loadingIntegrations ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">

              {/* ─── Categoria: Fontes de Tráfego ─── */}
              <div className="flex items-center gap-2 pt-1 pb-0.5">
                <span className="text-base">📡</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Fontes de Tráfego</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Plataformas de anúncios que trazem visitantes para o funil</p>
                </div>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-2" />
              </div>

              {/* ── Facebook Ads ── */}
              <IntegrationPanel
                icon={<Facebook className="w-5 h-5 text-blue-600" />}
                label="Meta / Facebook Ads"
                color="bg-blue-100 dark:bg-blue-900/40"
                connected={integrations.facebook}
                tutorialHref="/facebook-connect"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Access Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={fbCreds.accessToken}
                      onChange={e => setFbCreds({ ...fbCreds, accessToken: e.target.value })}
                      placeholder="EAAxxxxxxxxxx..."
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Token gerado via System User no Meta Business Manager</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Ad Account ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fbCreds.adAccountId}
                      onChange={e => setFbCreds({ ...fbCreds, adAccountId: e.target.value })}
                      placeholder="act_123456789"
                      className={inputMonoCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">App ID</label>
                    <input
                      type="text"
                      value={fbCreds.appId}
                      onChange={e => setFbCreds({ ...fbCreds, appId: e.target.value })}
                      placeholder="123456789012345"
                      className={inputMonoCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">App Secret</label>
                    <input
                      type="password"
                      value={fbCreds.appSecret}
                      onChange={e => setFbCreds({ ...fbCreds, appSecret: e.target.value })}
                      placeholder="abc123..."
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={fbStatus} />
                  <button
                    onClick={saveFacebook}
                    disabled={fbStatus === 'saving' || !fbCreds.accessToken || !fbCreds.adAccountId}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {fbStatus === 'saving' ? 'Salvando...' : integrations.facebook ? 'Atualizar credenciais' : 'Conectar Facebook'}
                  </button>
                </div>
              </IntegrationPanel>

              
              {/* ── Google Ads ── */}
              <IntegrationPanel
                icon={<span className="text-sm font-black text-white">G</span>}
                label="Google Ads"
                color="bg-gradient-to-br from-blue-500 via-red-400 to-yellow-400"
                connected={integrations.google}
                tutorialHref="https://ads.google.com/intl/pt-BR/home/"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Customer ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ggCreds.customerId}
                      onChange={e => setGgCreds({ ...ggCreds, customerId: e.target.value })}
                      placeholder="123-456-7890"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">ID da conta em Google Ads → no topo da tela</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Developer Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={ggCreds.developerToken}
                      onChange={e => setGgCreds({ ...ggCreds, developerToken: e.target.value })}
                      placeholder="Devel..."
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Google Ads API Center → Developer token</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Client ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ggCreds.clientId}
                      onChange={e => setGgCreds({ ...ggCreds, clientId: e.target.value })}
                      placeholder="xxxx.apps.googleusercontent.com"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Google Cloud Console → OAuth 2.0 → Client ID</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Client Secret <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={ggCreds.clientSecret}
                      onChange={e => setGgCreds({ ...ggCreds, clientSecret: e.target.value })}
                      placeholder="GOCSPX-..."
                      className={inputMonoCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Refresh Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={ggCreds.refreshToken}
                      onChange={e => setGgCreds({ ...ggCreds, refreshToken: e.target.value })}
                      placeholder="1//0g..."
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Gerado via OAuth flow com as credenciais acima</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={ggStatus} />
                  <button
                    disabled={ggStatus === 'saving' || !ggCreds.customerId || !ggCreds.developerToken || !ggCreds.clientId || !ggCreds.clientSecret || !ggCreds.refreshToken}
                    onClick={() => saveIntegration('/api/integrations/google', ggCreds, setGgStatus, () => setIntegrations(prev => ({ ...prev, google: true })))}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {ggStatus === 'saving' ? 'Salvando...' : integrations.google ? 'Atualizar credenciais' : 'Conectar Google Ads'}
                  </button>
                </div>
              </IntegrationPanel>

              {/* ── TikTok Ads ── */}
              <IntegrationPanel
                icon={<span className="text-sm font-black text-white">♪</span>}
                label="TikTok Ads"
                color="bg-black"
                connected={integrations.tiktok}
                tutorialHref="https://ads.tiktok.com/marketing_api/docs"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      App ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ttCreds.appId}
                      onChange={e => setTtCreds({ ...ttCreds, appId: e.target.value })}
                      placeholder="7xxxxxxxxxxxxxxxxx"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">TikTok for Developers → My Apps → App ID</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Secret <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={ttCreds.secret}
                      onChange={e => setTtCreds({ ...ttCreds, secret: e.target.value })}
                      placeholder="App Secret"
                      className={inputMonoCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Advertiser ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ttCreds.advertiserId}
                      onChange={e => setTtCreds({ ...ttCreds, advertiserId: e.target.value })}
                      placeholder="7xxxxxxxxxxxxxxxxx"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">TikTok Ads Manager → Account ID</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Access Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={ttCreds.accessToken}
                      onChange={e => setTtCreds({ ...ttCreds, accessToken: e.target.value })}
                      placeholder="act_..."
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Gerado em TikTok for Developers → Auth</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={ttStatus} />
                  <button
                    disabled={ttStatus === 'saving' || !ttCreds.appId || !ttCreds.secret || !ttCreds.advertiserId || !ttCreds.accessToken}
                    onClick={() => saveIntegration('/api/integrations/tiktok', ttCreds, setTtStatus, () => setIntegrations(prev => ({ ...prev, tiktok: true })))}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {ttStatus === 'saving' ? 'Salvando...' : integrations.tiktok ? 'Atualizar credenciais' : 'Conectar TikTok Ads'}
                  </button>
                </div>
              </IntegrationPanel>

              {/* ─── Categoria: Comunicação ─── */}
              <div className="flex items-center gap-2 pt-3 pb-0.5">
                <span className="text-base">💬</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Funil de Comunicação</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Canal de relacionamento e qualificação de leads</p>
                </div>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-2" />
              </div>

              {/* ── WhatsApp ── */}
              <IntegrationPanel
                icon={<MessageCircle className="w-5 h-5 text-green-600" />}
                label="WhatsApp Business API"
                color="bg-green-100 dark:bg-green-900/40"
                connected={integrations.whatsapp}
                tutorialHref="/whatsapp-connect"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Access Token <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={waCreds.accessToken}
                      onChange={e => setWaCreds({ ...waCreds, accessToken: e.target.value })}
                      placeholder="EAAxxxxxxxxxx..."
                      rows={2}
                      className={inputMonoCls + ' resize-none'}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Token permanente em Business Manager → Usuários do sistema</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Phone Number ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={waCreds.phoneNumberId}
                      onChange={e => setWaCreds({ ...waCreds, phoneNumberId: e.target.value })}
                      placeholder="123456789012345"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">ID do número em WhatsApp → Configuração</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      WABA ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={waCreds.businessAccountId}
                      onChange={e => setWaCreds({ ...waCreds, businessAccountId: e.target.value })}
                      placeholder="987654321098765"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">WhatsApp Business Account ID</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={waStatus} />
                  <button
                    onClick={saveWhatsApp}
                    disabled={waStatus === 'saving' || !waCreds.accessToken || !waCreds.phoneNumberId || !waCreds.businessAccountId}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {waStatus === 'saving' ? 'Salvando...' : integrations.whatsapp ? 'Atualizar credenciais' : 'Conectar WhatsApp'}
                  </button>
                </div>
              </IntegrationPanel>

              {/* ─── Categoria: Checkout ─── */}
              <div className="flex items-center gap-2 pt-3 pb-0.5">
                <span className="text-base">🛒</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Plataformas de Checkout</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Onde as vendas são finalizadas e o pagamento processado</p>
                </div>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-2" />
              </div>

              {/* ── Hotmart ── */}
              <IntegrationPanel
                icon={<ShoppingCart className="w-5 h-5 text-orange-600" />}
                label="Hotmart"
                color="bg-orange-100 dark:bg-orange-900/40"
                connected={integrations.hotmart}
                tutorialHref="/hotmart-connect"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Hotmart ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={hmCreds.hotmartId}
                      onChange={e => setHmCreds({ ...hmCreds, hotmartId: e.target.value })}
                      placeholder="123456"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">ID numérico do produto em Hotmart → Produtos</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">E-mail do Produtor</label>
                    <input
                      type="email"
                      value={hmCreds.email}
                      onChange={e => setHmCreds({ ...hmCreds, email: e.target.value })}
                      placeholder="exemplo@provedor.com"
                      autoComplete="off"
                      data-lpignore="true"
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Token de Segurança (Hottok) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={hmCreds.webhookToken}
                      onChange={e => setHmCreds({ ...hmCreds, webhookToken: e.target.value })}
                      placeholder="Cole aqui seu Hottok"
                      autoComplete="new-password"
                      data-lpignore="true"
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">O mesmo token inserido no campo Hottok do webhook na Hotmart (mín. 8 caracteres)</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={hmStatus} />
                  <button
                    onClick={saveHotmart}
                    disabled={hmStatus === 'saving' || !hmCreds.hotmartId || !hmCreds.webhookToken || hmCreds.webhookToken.length < 8}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {hmStatus === 'saving' ? 'Salvando...' : integrations.hotmart ? 'Atualizar credenciais' : 'Conectar Hotmart'}
                  </button>
                </div>
              </IntegrationPanel>

              {/* ── Kiwify ── */}
              <IntegrationPanel
                icon={<ShoppingCart className="w-5 h-5 text-green-600" />}
                label="Kiwify"
                color="bg-green-100 dark:bg-green-900/40"
                connected={integrations.kiwify}
                tutorialHref="/kiwify-connect"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Store ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={kwCreds.storeId}
                      onChange={e => setKwCreds({ ...kwCreds, storeId: e.target.value })}
                      placeholder="Cole aqui seu Store ID"
                      autoComplete="off"
                      data-lpignore="true"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Slug da sua loja em Kiwify → Configurações → Loja</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Secret Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={kwCreds.secretKey}
                      onChange={e => setKwCreds({ ...kwCreds, secretKey: e.target.value })}
                      placeholder="sk_live_..."
                      autoComplete="new-password"
                      data-lpignore="true"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Encontrada em Kiwify → API → Chaves → Secret Key</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={kwStatus} />
                  <button
                    onClick={saveKiwify}
                    disabled={kwStatus === 'saving' || !kwCreds.storeId || !kwCreds.secretKey}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {kwStatus === 'saving' ? 'Salvando...' : integrations.kiwify ? 'Atualizar credenciais' : 'Conectar Kiwify'}
                  </button>
                </div>
              </IntegrationPanel>

              {/* ── Eduzz ── */}
              <IntegrationPanel
                icon={<ShoppingCart className="w-5 h-5 text-purple-600" />}
                label="Eduzz"
                color="bg-purple-100 dark:bg-purple-900/40"
                connected={integrations.eduzz}
                tutorialHref="/eduzz-connect"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      E-mail Eduzz <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={ezCreds.email}
                      onChange={e => setEzCreds({ ...ezCreds, email: e.target.value })}
                      placeholder="exemplo@provedor.com"
                      autoComplete="off"
                      data-lpignore="true"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Public Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={ezCreds.publicKey}
                      onChange={e => setEzCreds({ ...ezCreds, publicKey: e.target.value })}
                      placeholder="Cole aqui sua Public Key"
                      autoComplete="new-password"
                      data-lpignore="true"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Encontrada em Eduzz → API → Chaves de acesso</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={ezStatus} />
                  <button
                    onClick={saveEduzz}
                    disabled={ezStatus === 'saving' || !ezCreds.email || !ezCreds.publicKey}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {ezStatus === 'saving' ? 'Salvando...' : integrations.eduzz ? 'Atualizar credenciais' : 'Conectar Eduzz'}
                  </button>
                </div>
              </IntegrationPanel>

              {/* ── Monetizze ── */}
              <IntegrationPanel
                icon={<ShoppingCart className="w-5 h-5 text-rose-600" />}
                label="Monetizze"
                color="bg-rose-100 dark:bg-rose-900/40"
                connected={integrations.monetizze}
                tutorialHref="/monetizze-connect"
              >
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      E-mail Monetizze <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={mzCreds.email}
                      onChange={e => setMzCreds({ ...mzCreds, email: e.target.value })}
                      placeholder="exemplo@provedor.com"
                      autoComplete="off"
                      data-lpignore="true"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={mzCreds.apiKey}
                      onChange={e => setMzCreds({ ...mzCreds, apiKey: e.target.value })}
                      placeholder="Cole aqui sua API Key"
                      autoComplete="new-password"
                      data-lpignore="true"
                      className={inputMonoCls}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Encontrada em Monetizze → Configurações → Chaves de API</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <StatusBadge status={mzStatus} />
                  <button
                    onClick={saveMonetizze}
                    disabled={mzStatus === 'saving' || !mzCreds.email || !mzCreds.apiKey}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {mzStatus === 'saving' ? 'Salvando...' : integrations.monetizze ? 'Atualizar credenciais' : 'Conectar Monetizze'}
                  </button>
                </div>
              </IntegrationPanel>

            </div>
          )}

          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              💡 <strong>Dica:</strong> Os campos marcados com <span className="text-red-500">*</span> são obrigatórios.
              Clique em <strong>Tutorial</strong> em cada integração para o passo a passo de como obter cada credencial.
            </p>
          </div>
        </section>

        {/* ── Metas ──────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 max-w-md mb-6 transition-colors">
          <div className="flex items-center gap-1 mb-3">
            <Database className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Metas do Lançamento</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Meta de Vendas', key: 'metaVendas' },
              { label: 'Meta de Faturamento (R$)', key: 'metaFaturamento' },
              { label: 'Meta de Leads', key: 'metaLeads' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                <input
                  type="number"
                  value={config[key as keyof typeof config] as number}
                  onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Custos ─────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6 transition-colors">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Custos</h2>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custo do Produto (R$)</label>
            <input
              type="number"
              value={config.custoProduto}
              onChange={e => setConfig({ ...config, custoProduto: Number(e.target.value) })}
              className={inputCls}
              step="0.01"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Usado para calcular lucro líquido e ROI real</p>
          </div>
        </section>

        {/* ── Alertas ────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configuração de Alertas</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Alerta de CPC Alto (R$)', key: 'alertaCPCAlto', step: '0.01', hint: 'Alertar quando CPC ultrapassar este valor' },
              { label: 'Alerta de Taxa de Conversão Baixa (%)', key: 'alertaTaxaConversaoBaixa', step: '1', hint: 'Alertar quando conversão cair abaixo deste valor' },
              { label: 'Alerta de Checkouts Abandonados (%)', key: 'alertaCheckoutAbandonado', step: '1', hint: 'Alertar quando taxa de abandono ultrapassar este valor' },
            ].map(({ label, key, step, hint }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                <input
                  type="number"
                  value={config[key as keyof typeof config] as number}
                  onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })}
                  className={inputCls + ' max-w-xs'}
                  step={step}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Alertas Automáticos (SCALE) ────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Alertas Automáticos</h2>
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-full">
                SCALE
              </span>
            </div>
            <StatusBadge status={alertStatus} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Avaliados uma vez por dia. Disparam notificações automáticas quando algo importante acontece.
          </p>

          {!alertEnabled && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
              ⚠️ Recurso disponível apenas no plano <strong>SCALE</strong>. Você está no <strong>{alertPlan}</strong>.{' '}
              <Link href="/pricing" className="underline font-semibold">Fazer upgrade</Link>
            </div>
          )}

          <div className={`space-y-3 ${alertEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            {ALERT_RULES.map((rule) => (
              <label
                key={rule.key}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={alertSettings[rule.key]}
                  disabled={!alertEnabled}
                  onChange={(e) => toggleAlertRule(rule.key, e.target.checked)}
                  className="mt-1 w-5 h-5 text-orange-600 rounded focus:ring-2 focus:ring-orange-400 dark:bg-gray-700 dark:border-gray-600"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{rule.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{rule.description}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ── Notificações ───────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6 transition-colors">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Notificações</h2>
          <div className="space-y-3">
            {[
              { key: 'emailAlertas', label: 'Receber alertas por email' },
              { key: 'whatsappAlertas', label: 'Receber alertas por WhatsApp' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config[key as keyof typeof config] as boolean}
                  onChange={e => setConfig({ ...config, [key]: e.target.checked })}
                  className="w-5 h-5 text-whatsapp-light rounded focus:ring-2 focus:ring-whatsapp-light dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* ── Salvar ─────────────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-whatsapp-light hover:bg-whatsapp-dark text-white'
            }`}
          >
            {saved
              ? <><Check className="w-5 h-5" /> Salvo com sucesso!</>
              : <><Save className="w-5 h-5" /> Salvar Configurações</>}
          </button>
        </div>
      </main>
    </div>
  )
}
