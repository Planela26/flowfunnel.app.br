// Fonte única de verdade para o que é considerado "venda" em todo o sistema.
// Usado por reports, analytics/timeseries, analytics/comparison e cron/snapshot
// para evitar divergência entre gráficos, relatórios e snapshots.

const PURCHASE_EVENT_RX = /_purchase_complete$/
const CHECKOUT_EVENT_RX = /_checkout_started$/

export function isSaleEvent(eventType: string): boolean {
  return PURCHASE_EVENT_RX.test(eventType)
}

export function isCheckoutEvent(eventType: string): boolean {
  return CHECKOUT_EVENT_RX.test(eventType)
}

// Status que indicam que a venda NÃO deve ser contabilizada como receita.
export function isCanceledSale(meta: any): boolean {
  const s = String(meta?.status || '').toLowerCase()
  return ['canceled', 'cancelled', 'refunded', 'reembolsado', 'chargeback', 'recusado', 'refused'].includes(s)
}

export function extractAmount(meta: any): number {
  const raw = meta?.amount ?? meta?.price ?? 0
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
  return Number.isFinite(n) ? n : 0
}

// Identificador único da transação, usado para deduplicar vendas que possam
// chegar por mais de um evento/integração (ex: Hotmart + Stripe para a mesma compra).
export function saleTransactionId(meta: any): string | null {
  const id =
    meta?.transactionId ??
    meta?.transaction_id ??
    meta?.orderId ??
    meta?.order_id ??
    meta?.transaction ??
    meta?.id ??
    null
  return id != null ? String(id) : null
}
