'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { authPatternUrl, authPatternSize } from '@/lib/authPattern'
import {
  ArrowLeft, Check, Shield, RefreshCw, Zap, Copy,
  CheckCircle2, QrCode,
} from 'lucide-react'
import Link from 'next/link'

// ─── Plan Info ───────────────────────────────────────────────────────
const PLAN_INFO: Record<string, { name: string; desc: string; features: string[]; badge?: string; price: string; conversations: string }> = {
  START: {
    name: 'START', desc: 'Ideal para quem está começando',
    price: 'R$97/mês', conversations: '1.000 conversas/mês',
    features: [
      'Até 1.000 conversas rastreadas/mês', 'Análise por IA do funil de vendas',
      'Rastreamento WhatsApp + Hotmart/Kiwify', '1 número de WhatsApp e 1 funil ativo',
      'Relatórios e insights automáticos',
    ],
  },
  PRO: {
    name: 'PRO', desc: 'Para quem anuncia todo dia', badge: 'Mais popular',
    price: 'R$147/mês', conversations: '3.000 conversas/mês',
    features: [
      'Até 3.000 conversas rastreadas/mês', 'IA com diagnóstico e sugestões avançadas',
      'Até 3 números de WhatsApp', 'Comparação de períodos',
      'Rastreamento completo de plataformas',
    ],
  },
  SCALE: {
    name: 'SCALE', desc: 'Para agências e grandes operações',
    price: 'R$297/mês', conversations: 'Conversas ilimitadas',
    features: [
      'Conversas ilimitadas', 'IA avançada com alertas automáticos',
      'WhatsApps e funis ilimitados', 'Histórico estendido', 'Suporte prioritário',
    ],
  },
}

// ─── Confetti / Fireworks Canvas ─────────────────────────────────────
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

    type Particle = { x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number; decay: number }
    type Confetto = { x: number; y: number; vx: number; vy: number; color: string; w: number; h: number; rot: number; rotV: number }

    const particles: Particle[] = []
    const confetti: Confetto[] = []

    const burst = (x: number, y: number, count = 90) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
        const speed = 2 + Math.random() * 7
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 3 + Math.random() * 5,
          alpha: 1,
          decay: 0.010 + Math.random() * 0.008,
        })
      }
    }

    for (let i = 0; i < 180; i++) {
      confetti.push({
        x: Math.random() * window.innerWidth,
        y: -30 - Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 8 + Math.random() * 10, h: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.25,
      })
    }

    // Staggered firework bursts across the screen
    const bursts: Array<[number, number, number]> = [
      [0.3, 0.4, 0], [0.7, 0.35, 250], [0.5, 0.28, 550],
      [0.15, 0.5, 850], [0.85, 0.45, 1150], [0.5, 0.45, 1600],
      [0.25, 0.35, 2100], [0.75, 0.4, 2500],
    ]
    const timers = bursts.map(([rx, ry, delay]) =>
      setTimeout(() => burst(canvas.width * rx, canvas.height * ry), delay)
    )

    let animId: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.alpha -= p.decay
        if (p.alpha <= 0) { particles.splice(i, 1); continue }
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      }

      ctx.globalAlpha = 1
      for (const c of confetti) {
        c.x += c.vx; c.y += c.vy; c.rot += c.rotV
        if (c.y > canvas.height + 30) { c.y = -30; c.x = Math.random() * canvas.width }
        ctx.save()
        ctx.translate(c.x, c.y); ctx.rotate(c.rot)
        ctx.fillStyle = c.color
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h)
        ctx.restore()
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 100 }} />
}

// ─── Celebration Screen ───────────────────────────────────────────────
function CelebrationScreen({ planKey }: { planKey: string }) {
  const info = PLAN_INFO[planKey] || PLAN_INFO['PRO']
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <Confetti />
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 101, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(6px)' }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg text-center transition-all duration-500"
          style={{
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(24px)',
            opacity: visible ? 1 : 0,
          }}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-5">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h1 className="text-3xl font-black text-gray-900 mb-1">Parabéns!</h1>
            <p className="text-gray-500 text-base">Seu pagamento foi confirmado com sucesso.</p>
          </div>

          {/* Plan badge */}
          <div className="mx-8 mb-5 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-5 text-white text-left">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-blue-100 text-xs uppercase tracking-widest font-semibold mb-1">Plano ativo</p>
                <h2 className="text-2xl font-black">Plano {info.name}</h2>
                <p className="text-blue-100 text-sm mt-0.5">{info.desc}</p>
              </div>
              <div className="bg-white/20 rounded-xl px-3 py-1.5 text-sm font-bold whitespace-nowrap ml-3">
                {info.price}
              </div>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-2 text-sm font-semibold">
              📊 {info.conversations} rastreadas
            </div>
          </div>

          {/* Features */}
          <div className="mx-8 mb-6 text-left space-y-2.5">
            {info.features.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-green-600" strokeWidth={3} />
                </div>
                <span className="text-sm text-gray-700 font-medium leading-snug">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-8 pb-8 space-y-3">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-base px-6 py-4 rounded-2xl transition shadow-lg shadow-blue-200"
            >
              🚀 Ver meu dashboard
            </Link>
            <Link
              href="/dashboard"
              onClick={() => {
                // Clear any open funnel after navigating
              }}
              className="flex items-center justify-center gap-2 w-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm px-6 py-3 rounded-2xl transition"
            >
              Ir para meus funis
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Hooks ───────────────────────────────────────────────────────────
function usePlanPrices() {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/plan-prices')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, number> = {}
        data.prices?.forEach((p: any) => { map[p.plan] = p.price })
        setPrices(map)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])
  return { prices, loading }
}

// Load the Mercado Pago SDK script once
function useMercadoPagoSdk() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).MercadoPago) { setReady(true); return }
    const existing = document.querySelector('script[data-mp-sdk]')
    if (existing) {
      existing.addEventListener('load', () => setReady(true))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.setAttribute('data-mp-sdk', 'true')
    script.onload = () => setReady(true)
    document.body.appendChild(script)
  }, [])
  return ready
}

// ─── Mercado Pago Payment Brick (embedded) ──────────────────────────
function PaymentBrickCheckout({
  plan,
  amount,
  couponCode,
  affiliateId,
  onPaid,
}: {
  plan: string
  amount: number
  couponCode?: string | null
  affiliateId?: string | null
  onPaid: (plan: string) => void
}) {
  const sdkReady = useMercadoPagoSdk()
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<any>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [brickError, setBrickError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null)
  const [paymentId, setPaymentId] = useState<number | null>(null)
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [polling, setPolling] = useState(false)

  const dataRef = useRef({ plan, amount, couponCode, affiliateId })
  useEffect(() => {
    dataRef.current = { plan, amount, couponCode, affiliateId }
  }, [plan, amount, couponCode, affiliateId])

  const idemKeyRef = useRef<string | null>(null)
  const purchaseFiredRef = useRef(false)

  // Meta Pixel: Purchase — fired ONLY on an APPROVED Mercado Pago payment.
  // Uses the SAME event_id as the CAPI/webhook (purchase_mp_<paymentId>) so Meta
  // deduplicates. Guarded to fire at most once.
  const fireMetaPurchase = (mpPaymentId: number | string | null | undefined, value: number) => {
    if (purchaseFiredRef.current || !mpPaymentId) return
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
    purchaseFiredRef.current = true
    window.fbq('track', 'Purchase', { value, currency: 'BRL' }, { eventID: `purchase_mp_${mpPaymentId}` })
  }

  // Fetch public key
  useEffect(() => {
    fetch('/api/mercadopago/public-key')
      .then(r => r.json())
      .then(d => { if (d.publicKey) setPublicKey(d.publicKey); else setBrickError('Mercado Pago não configurado') })
      .catch(() => setBrickError('Falha ao carregar pagamento'))
  }, [])

  // Poll payment status every 3s after PIX QR is shown
  useEffect(() => {
    if (!pixData || !paymentId) return
    setPolling(true)

    const check = async () => {
      try {
        const res = await fetch(`/api/mercadopago/payment-status?id=${paymentId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'approved') {
          setPolling(false)
          fireMetaPurchase(paymentId, dataRef.current.amount)
          onPaid(dataRef.current.plan)
        }
      } catch {}
    }

    check() // immediate first check
    const interval = setInterval(check, 3000)
    return () => { clearInterval(interval); setPolling(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixData, paymentId])

  // Render the brick when SDK + public key are ready and amount is known
  useEffect(() => {
    if (!sdkReady || !publicKey || !containerRef.current || amount <= 0) return
    if (pixData || boletoUrl) return

    let cancelled = false
    const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' })
    const bricksBuilder = mp.bricks()

    const render = async () => {
      if (controllerRef.current) {
        try { await controllerRef.current.unmount() } catch {}
        controllerRef.current = null
      }
      try {
        controllerRef.current = await bricksBuilder.create('payment', 'paymentBrick_container', {
          initialization: { amount },
          customization: {
            visual: { style: { theme: 'default' } },
            paymentMethods: {
              ticket: 'all',
              bankTransfer: 'all',
              creditCard: 'all',
              debitCard: 'all',
            },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: ({ formData }: any) => {
              setProcessing(true)
              setBrickError('')
              const d = dataRef.current
              if (!idemKeyRef.current) {
                idemKeyRef.current = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
              }
              return fetch('/api/mercadopago/process-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  plan: d.plan,
                  couponCode: d.couponCode || null,
                  affiliateId: d.affiliateId || null,
                  idempotencyKey: idemKeyRef.current,
                  token: formData.token || null,
                  payment_method_id: formData.payment_method_id,
                  issuer_id: formData.issuer_id || null,
                  installments: formData.installments || null,
                  payer: formData.payer || null,
                }),
              })
                .then(async (res) => {
                  const result = await res.json()
                  if (!res.ok) throw new Error(result.error || 'Erro ao processar pagamento')

                  if (result.status === 'approved') {
                    fireMetaPurchase(result.id, d.amount)
                    onPaid(d.plan)
                    return
                  }
                  // PIX → show QR code + start polling
                  if (result.qr_code_base64 || result.qr_code) {
                    setPixData({ qr_code: result.qr_code, qr_code_base64: result.qr_code_base64 })
                    setPaymentId(result.id)
                    if (controllerRef.current) { try { await controllerRef.current.unmount() } catch {} }
                    return
                  }
                  // Boleto → show link
                  if (result.boleto_url || result.ticket_url) {
                    setBoletoUrl(result.boleto_url || result.ticket_url)
                    if (controllerRef.current) { try { await controllerRef.current.unmount() } catch {} }
                    return
                  }
                  if (result.status === 'in_process' || result.status === 'pending') {
                    onPaid(d.plan)
                    return
                  }
                  if (result.status === 'rejected') {
                    idemKeyRef.current = null
                    throw new Error('Pagamento recusado. Verifique os dados e tente novamente.')
                  }
                })
                .catch((err) => {
                  idemKeyRef.current = null
                  setBrickError(err.message || 'Erro ao processar pagamento')
                  throw err
                })
                .finally(() => setProcessing(false))
            },
            onError: (error: any) => {
              console.error('Brick error:', error)
              setBrickError('Erro no formulário de pagamento. Recarregue a página.')
            },
          },
        })
      } catch (err: any) {
        if (!cancelled) setBrickError('Não foi possível carregar o checkout')
      }
    }

    render()

    return () => {
      cancelled = true
      if (controllerRef.current) {
        try { controllerRef.current.unmount() } catch {}
        controllerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, publicKey, amount])

  const copyPix = () => {
    if (!pixData?.qr_code) return
    navigator.clipboard.writeText(pixData.qr_code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── PIX result view ──
  if (pixData) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-teal-600" />
          <h3 className="text-gray-900 font-semibold">Pague com PIX</h3>
        </div>
        <div className="p-5 space-y-4 text-center">
          {pixData.qr_code_base64 && (
            <img
              src={`data:image/png;base64,${pixData.qr_code_base64}`}
              alt="QR Code PIX"
              className="w-56 h-56 mx-auto border border-gray-100 rounded-xl"
            />
          )}
          <p className="text-sm text-gray-600">Abra o app do seu banco, escaneie o QR Code ou copie o código abaixo.</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={pixData.qr_code || ''}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 bg-gray-50 truncate"
            />
            <button
              onClick={copyPix}
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          {/* Polling indicator */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            {polling ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
                <p className="text-blue-700 text-xs font-medium text-left">
                  Aguardando confirmação do pagamento... Avisaremos assim que o PIX for processado. 🔔
                </p>
              </>
            ) : (
              <>
                <div className="w-4 h-4 bg-blue-100 rounded-full flex-shrink-0" />
                <p className="text-blue-700 text-xs text-left">
                  Iniciando verificação do pagamento...
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Boleto result view ──
  if (boletoUrl) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-gray-900 font-semibold">Boleto gerado!</h3>
        </div>
        <div className="p-5 space-y-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-blue-500 mx-auto" />
          <p className="text-sm text-gray-600">Seu boleto foi gerado. Clique abaixo para visualizar e pagar.</p>
          <a
            href={boletoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition w-full"
          >
            Visualizar boleto
          </a>
          <p className="text-xs text-gray-400">A compensação pode levar de 1 a 3 dias úteis.</p>
        </div>
      </div>
    )
  }

  // ── Brick view ──
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-gray-900 font-semibold">Pagamento</h3>
        <p className="text-gray-500 text-sm mt-1">PIX, Boleto ou Cartão — tudo aqui, sem sair do site</p>
      </div>
      <div className="p-5">
        {brickError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-600 text-sm">{brickError}</p>
          </div>
        )}
        {(!sdkReady || !publicKey) && !brickError && (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Carregando formas de pagamento...</p>
          </div>
        )}
        <div id="paymentBrick_container" ref={containerRef} />
        {processing && (
          <div className="flex items-center justify-center gap-2 py-3 mt-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Processando pagamento...</p>
          </div>
        )}
      </div>
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-gray-500 text-xs text-center">Pagamento processado por Mercado Pago. Ambiente seguro.</p>
      </div>
    </div>
  )
}

// ─── Checkout Inner ──────────────────────────────────────────────────
function CheckoutInner({ planKey }: { planKey: string }) {
  const planInfo = PLAN_INFO[planKey] || PLAN_INFO['PRO']
  const { prices, loading: pricesLoading } = usePlanPrices()
  const price = prices[planKey] || 0

  // Meta Pixel: InitiateCheckout — fires once when the checkout opens and the
  // price is known. Pixel-only (no payment yet); a unique eventID is included.
  const initiateCheckoutFired = useRef(false)
  useEffect(() => {
    if (initiateCheckoutFired.current || price <= 0) return
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
    initiateCheckoutFired.current = true
    const eventId = `ic_${planKey}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    window.fbq('track', 'InitiateCheckout', { value: price, currency: 'BRL', content_name: planKey }, { eventID: eventId })
  }, [price, planKey])

  const [affiliateId, setAffiliateId] = useState<string | null>(null)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [paidPlan, setPaidPlan] = useState<string | null>(null)

  // Coupon / ref state
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; name: string; discount: number } | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')

  const searchParams = useSearchParams()

  // On mount: auto-apply affiliate code from the URL (?ref/?aff/?code) or, as
  // fallback, from a previously saved code in localStorage. The URL code wins
  // (link de afiliado recém-clicado) e fica persistido para futuras visitas.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const fromUrl = searchParams.get('ref') || searchParams.get('aff') || searchParams.get('code')
    const code = (fromUrl || localStorage.getItem('affiliate_code') || '').trim()
    if (!code) return
    fetch('/api/affiliates/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then(r => r.json()).then(data => {
      if (data.valid) {
        setAppliedCoupon({ code: data.affiliate.code, name: data.affiliate.name, discount: data.affiliate.discountPercent })
        setAffiliateId(data.affiliate.id)
        setDiscountPercent(data.affiliate.discountPercent)
        localStorage.setItem('affiliate_code', data.affiliate.code)
      }
    }).catch(() => {})
  }, [searchParams])

  const applyCoupon = async () => {
    if (!couponInput.trim()) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const res = await fetch('/api/affiliates/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput }),
      })
      const data = await res.json()
      if (!data.valid) { setCouponError(data.error || 'Código inválido'); setCouponLoading(false); return }
      setAppliedCoupon({ code: data.affiliate.code, name: data.affiliate.name, discount: data.affiliate.discountPercent })
      setAffiliateId(data.affiliate.id)
      setDiscountPercent(data.affiliate.discountPercent)
      setCouponInput('')
      setCouponError('')
      localStorage.setItem('affiliate_code', data.affiliate.code)
    } catch {
      setCouponError('Erro ao validar o código')
    }
    setCouponLoading(false)
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setAffiliateId(null)
    setDiscountPercent(0)
    localStorage.removeItem('affiliate_code')
  }

  const discountedPrice = discountPercent > 0
    ? Math.round(price * (1 - discountPercent / 100))
    : price

  return (
    <>
      {/* Celebration overlay — rendered on top of everything */}
      {paidPlan && <CelebrationScreen planKey={paidPlan} />}

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* ── Left: Plan Card ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 border border-gray-100">
            <div>
              {planInfo.badge && (
                <span className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
                  {planInfo.badge}
                </span>
              )}
              <p className="text-blue-500 text-xs uppercase tracking-widest font-semibold mb-1.5">Você está assinando</p>
              <h1 className="text-3xl font-black leading-tight text-blue-700">Plano {planInfo.name}</h1>
              <p className="text-sm mt-1" style={{ color: '#64748b' }}>{planInfo.desc}</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <div className="flex justify-between items-center text-sm mb-2.5">
                <span style={{ color: '#475569' }} className="font-medium">Plano {planInfo.name}</span>
                <span style={{ color: '#1e293b' }} className="font-semibold">
                  {pricesLoading ? '...' : `R$${price}/mês`}
                </span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between items-center text-sm mb-2.5">
                  <span className="text-green-700 font-medium">Desconto ({discountPercent}%)</span>
                  <span className="text-green-700 font-semibold">- R${((price * discountPercent) / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-blue-100 pt-2.5 flex justify-between items-end">
                <span style={{ color: '#64748b' }} className="text-xs font-medium">Total hoje</span>
                <div className="text-right">
                  {discountPercent > 0 && (
                    <div className="text-sm text-gray-400 line-through leading-none mb-0.5">R${price}</div>
                  )}
                  <div className="text-3xl font-black text-blue-700 leading-none">
                    {pricesLoading ? '...' : `R$${discountedPrice}`}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>renovação automática mensal</div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Incluído no plano:</p>
              {planInfo.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-sm leading-snug font-semibold" style={{ color: '#334155' }}>{f}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 pt-2" style={{ borderTop: '1px solid #f1f5f9' }}>
              {[
                { icon: '🔒', text: 'Pagamento 100% seguro via Mercado Pago' },
                { icon: '↙️', text: 'Garantia de 7 dias ou dinheiro de volta' },
                { icon: '🚀', text: 'Acesso liberado imediatamente após o pagamento' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{b.icon}</span>
                  <span className="text-xs leading-tight" style={{ color: '#64748b' }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Payment Form ── */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Card header */}
            <div className="px-7 pt-7 pb-5 border-b border-gray-100">
              <h2 className="text-gray-900 font-bold text-xl">Forma de pagamento</h2>
              <p className="text-gray-500 text-sm mt-1">Pague com PIX, boleto bancário ou cartão de crédito</p>
            </div>

            {/* Coupon / Affiliate Section */}
            <div className="mx-7 mt-5">
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                      <p className="text-green-800 font-bold text-sm">{appliedCoupon.discount}% de desconto aplicado!</p>
                      <p className="text-green-600 text-xs">Código <span className="font-mono font-bold">{appliedCoupon.code}</span> · {appliedCoupon.name}</p>
                    </div>
                  </div>
                  <button onClick={removeCoupon} className="text-green-600 hover:text-green-800 text-xs underline ml-2 flex-shrink-0">Remover</button>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cupom de desconto</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                      onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                      placeholder="Ex: AMELIA10"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white text-gray-900 placeholder-gray-400"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition flex-shrink-0"
                    >
                      {couponLoading ? '...' : 'Aplicar'}
                    </button>
                  </div>
                  {couponError && <p className="text-red-500 text-xs mt-1.5">{couponError}</p>}
                </div>
              )}
            </div>

            {/* Mercado Pago Payment Brick - embedded */}
            <div className="mx-7 mt-4">
              {!pricesLoading && discountedPrice > 0 ? (
                <PaymentBrickCheckout
                  plan={planKey}
                  amount={discountedPrice}
                  couponCode={appliedCoupon?.code || null}
                  affiliateId={affiliateId}
                  onPaid={(plan) => setPaidPlan(plan)}
                />
              ) : (
                <div className="flex items-center justify-center gap-2 py-8 bg-white border border-gray-200 rounded-2xl">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-gray-500 text-sm">Carregando...</p>
                </div>
              )}
            </div>

            {/* Security footer */}
            <div className="px-7 pb-7 pt-5">
              <div className="flex items-center justify-center gap-4 text-slate-400 text-xs pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> SSL 256-bit</span>
                <span>·</span>
                <span className="flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> Cancele quando quiser</span>
                <span>·</span>
                <span className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> Acesso imediato</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Page ────────────────────────────────────────────────────────────
function CheckoutPageContent() {
  const searchParams = useSearchParams()
  const planParam = (searchParams.get('plan') || 'PRO').toUpperCase()

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 overflow-hidden flex flex-col">
      <style>{`
        @keyframes diagonalScroll {
          from { background-position: 0px 0px; }
          to   { background-position: 240px 240px; }
        }
        .checkout-pattern {
          background-image: ${authPatternUrl};
          background-size: ${authPatternSize};
          animation: diagonalScroll 14s linear infinite;
          opacity: 0.5;
        }
      `}</style>
      <div className="checkout-pattern absolute inset-0 pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden">
              <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
            </div>
            <span className="text-base sm:text-lg font-extrabold text-white tracking-tight">FlowFunnel</span>
          </div>
          <Link href="/pricing" className="flex items-center gap-1.5 text-blue-200 hover:text-white text-sm transition">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Voltar aos planos</span>
          </Link>
        </header>

        <div className="flex-1 flex items-start justify-center px-3 sm:px-4 py-6 sm:py-10">
          <CheckoutInner planKey={planParam} />
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  )
}
