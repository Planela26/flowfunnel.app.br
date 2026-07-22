import { Plan } from './plans'

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

  const response = await fetch(`${API_BASE}/v1/payments`, {
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

export function getPlanPrice(plan: Plan): number {
  switch (plan) {
    case 'START': return 97.00
    case 'PRO': return 147.00
    case 'SCALE': return 297.00
    default: return 0
  }
}

export function getPlanName(plan: Plan): string {
  switch (plan) {
    case 'START': return 'START — Até 1.000 conversas/mês'
    case 'PRO': return 'PRO — Até 3.000 conversas/mês'
    case 'SCALE': return 'SCALE — Conversas ilimitadas'
    default: return 'FREE'
  }
}
