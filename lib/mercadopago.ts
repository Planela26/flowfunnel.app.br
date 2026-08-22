import { Plan, PLAN_PRICES_BRL } from './plans'

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const API_BASE = 'https://api.mercadopago.com'

export interface MercadoPagoItem {
  title: string
  unit_price: number
  quantity: number
  currency_id: 'BRL'
}

export interface MercadoPagoPreference {
  items: MercadoPagoItem[]
  payer: {
    email: string
    name?: string
    identification?: {
      type: 'CPF' | 'CNPJ'
      number: string
    }
  }
  back_urls: {
    success: string
    failure: string
    pending: string
  }
  auto_return: 'approved' | 'all'
  external_reference: string
  notification_url: string
  payment_methods?: {
    excluded_payment_types?: { id: string }[]
    excluded_payment_methods?: { id: string }[]
  } | null
}

export interface MercadoPagoPayment {
  id: number
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded'
  status_detail: string
  transaction_amount: number
  date_created: string
  date_approved: string | null
  external_reference: string | null
  payment_method_id: string
  payment_type_id: string
  payer: {
    email: string
    id: number
  }
}

export async function createPreference(preference: MercadoPagoPreference) {
  if (!ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')
  }

  const response = await fetch(`${API_BASE}/checkout/preferences`, {
    signal: AbortSignal.timeout(20_000),
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Mercado Pago error: ${response.status} ${error}`)
  }

  return response.json()
}

export interface CreatePaymentInput {
  transaction_amount: number
  description: string
  payment_method_id: string
  payer: {
    email: string
    first_name?: string
    last_name?: string
    identification?: {
      type: 'CPF' | 'CNPJ'
      number: string
    }
  }
  token?: string
  installments?: number
  issuer_id?: string
  external_reference: string
  notification_url?: string
  /**
   * Validade da cobrança, ISO 8601 com offset (ex.: 2026-08-17T12:00:00.000-03:00).
   * Usado no PIX: sem definir, vale o padrão do Mercado Pago, e aí não há
   * garantia de que o copia-e-cola ainda funcione quando o e-mail de lembrete
   * sair uma hora depois.
   */
  date_of_expiration?: string
}

export interface CreatePaymentResult {
  id: number
  status: string
  status_detail: string
  payment_method_id: string
  payment_type_id: string
  transaction_amount: number
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
      ticket_url?: string
    }
  }
  transaction_details?: {
    external_resource_url?: string
  }
}

export async function createPayment(
  input: CreatePaymentInput,
  idempotencyKey: string
): Promise<CreatePaymentResult> {
  if (!ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')
  }

  // 30s, mais folgado que as outras chamadas de propósito: abortar uma criação
  // de pagamento que o Mercado Pago JÁ processou não desfaz a cobrança — só nos
  // deixa sem saber o resultado dela. O prazo existe para não segurar a conexão
  // indefinidamente, não para cortar cedo.
  const response = await fetch(`${API_BASE}/v1/payments`, {
    signal: AbortSignal.timeout(30_000),
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Mercado Pago error: ${response.status} ${error}`)
  }

  return response.json()
}

export async function getPayment(paymentId: number): Promise<MercadoPagoPayment> {
  if (!ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured')
  }

  const response = await fetch(`${API_BASE}/v1/payments/${paymentId}`, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Mercado Pago error: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Valor cobrado pelo Mercado Pago. Lê de PLAN_PRICES_BRL para não divergir do
 * que a vitrine anuncia — antes esta tabela era uma segunda cópia dos preços.
 */
export function getPlanPrice(plan: Plan): number {
  return PLAN_PRICES_BRL[plan] ?? 0
}

export function getPlanName(plan: Plan): string {
  switch (plan) {
    case 'START': return 'START — Até 1.000 conversas/mês'
    case 'PRO': return 'PRO — Até 3.000 conversas/mês'
    case 'SCALE': return 'SCALE — Conversas ilimitadas'
    default: return 'FREE'
  }
}
