/**
 * Formato dos payloads de webhook das plataformas de checkout.
 *
 * Este arquivo não tem NENHUM código em execução — são só declarações de tipo,
 * apagadas na compilação. O binário gerado é byte a byte o mesmo.
 *
 * Por que existe: `lib/webhook-handlers.ts` recebia todos os payloads como
 * `any`, e `any` desliga o compilador exatamente onde entra dinheiro. Foi assim
 * que a leitura de `purchase.price.value` passou sem uma linha de aviso num
 * payload da Hotmart que não tinha esse campo — a venda entrou com R$ 0,00 e
 * derrubou o faturamento do período inteiro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REGRA DESTE ARQUIVO: TODO CAMPO É OPCIONAL.
 *
 * Não é preguiça — é o fato. Um webhook é entrada externa: a plataforma pode
 * omitir qualquer campo, renomear qualquer campo, ou mandar uma versão de
 * payload que ninguém previu. Um tipo que promete `price: number` estaria
 * mentindo, e a mentira reapareceria como `undefined` em produção.
 *
 * Marcando tudo como opcional, o compilador OBRIGA quem lê a lidar com a
 * ausência — que é a única postura correta diante de dado que vem de fora.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Os campos aqui são os que os handlers de fato leem, levantados do próprio
 * código. Se uma plataforma manda mais coisas, elas simplesmente não estão
 * descritas — descrever payload inteiro sem necessidade cria manutenção sem
 * retorno.
 */

/** Valor que pode chegar como número, como string, ou não chegar. */
export type ValorBruto = number | string | null | undefined

/**
 * Data de evento. Vem em milissegundos (Hotmart 2.0.0), em segundos, ou como
 * texto ISO — por isso o tipo é largo e `dataDeWebhook()` faz a normalização.
 */
export type DataBruta = number | string | null | undefined

/** Objeto monetário da Hotmart: `{ value, currency_value }`. */
export type ValorMonetario = {
  value?: ValorBruto
  currency_value?: string | null
}

// ─────────────────────────────── HOTMART ───────────────────────────────
// Documentado em developers.hotmart.com/docs/pt-BR/2.0.0/webhook/purchase-webhook

/**
 * O objeto `data` do webhook 2.0.0. O envelope (`id`, `event`, `version`,
 * `creation_date`) fica um nível acima; os handlers recebem só o `data`,
 * exceto `hotmartCartAbandoned`, que também olha `creation_date`.
 */
export type HotmartData = {
  creation_date?: DataBruta

  product?: {
    id?: number | string | null
    ucode?: string | null
    name?: string | null
  }

  buyer?: {
    email?: string | null
    name?: string | null
    phone?: string | null
    checkout_phone?: string | null
  }

  purchase?: {
    transaction?: string | number | null
    status?: string | null
    approved_date?: DataBruta
    order_date?: DataBruta

    /**
     * Os TRÊS objetos de preço, e nenhum é garantido. Ler só o primeiro foi o
     * defeito que zerou o faturamento; `valorDaCompra()` tenta os três.
     */
    price?: ValorMonetario
    full_price?: ValorMonetario
    original_offer_price?: ValorMonetario

    /** Parâmetro de rastreio injetado pelo tracker no link do checkout. */
    sck?: string | null
    sckPaymentLink?: string | null
    origin?: { sck?: string | null }
    checkout_origin?: { sck?: string | null }
    tracking?: { source_sck?: string | null }
  }

  /** Alguns payloads trazem o `src` na raiz do `data`. */
  src?: string | null
}

// ─────────────────────────────── KIWIFY ────────────────────────────────

export type KiwifyBody = {
  order_status?: string | null
  status?: string | null
  order?: { id?: string | number | null }
  order_id?: string | number | null

  /** Em CENTAVOS — o handler divide por 100. */
  amount?: ValorBruto

  customer?: {
    email?: string | null
    name?: string | null
    phone?: string | null
    mobile?: string | null
  }
  email?: string | null
  name?: string | null
  phone?: string | null

  product?: { name?: string | null }
  product_name?: string | null

  TrackingParameters?: { s1?: string | null; s2?: string | null; s3?: string | null }
  tracking?: { s1?: string | null }
  s1?: string | null
}

// ──────────────────────────────── EDUZZ ────────────────────────────────

export type EduzzBody = {
  trans_status_name?: string | null
  event?: string | null
  status?: string | null

  trans_cod?: string | number | null
  transaction?: string | number | null

  trans_value?: ValorBruto
  amount?: ValorBruto

  cus_email?: string | null
  cus_name?: string | null
  cus_tel?: string | null
  cus_phone?: string | null
  email?: string | null
  name?: string | null
  phone?: string | null

  con_title?: string | null
  product_name?: string | null

  utm_content?: string | null
  trans_utm_content?: string | null
  tracker?: string | null
  tracker2?: string | null
  tracker3?: string | null
}

// ────────────────────────────── MONETIZZE ──────────────────────────────

export type MonetizzeBody = {
  status_name?: string | null
  event?: string | null
  status?: string | null

  transaction?: string | number | null
  code?: string | number | null

  amount?: ValorBruto
  price?: ValorBruto

  buyer?: { email?: string | null; name?: string | null; phone?: string | null }
  /** A Monetizze manda os mesmos dados em português em alguns payloads. */
  comprador?: { email?: string | null; nome?: string | null; telefone?: string | null }
  email?: string | null
  name?: string | null
  telefone?: string | null
  phone?: string | null

  product?: { name?: string | null }
  product_name?: string | null

  tracking?: { src?: string | null; utm_content?: string | null }
  src?: string | null
  venda?: { src?: string | null }
}

// ───────────────────────────── PERFECT PAY ─────────────────────────────

export type PerfectPayBody = {
  sale_status_enum?: string | number | null
  status?: string | null

  sale_id?: string | number | null
  id?: string | number | null

  sale_amount?: ValorBruto
  amount?: ValorBruto

  customer?: { name?: string | null; email?: string | null; phone?: string | null }
  buyer_name?: string | null
  buyer_email?: string | null
  buyer_phone?: string | null

  product?: { name?: string | null }
  product_name?: string | null

  tracking?: { src?: string | null; utm_content?: string | null }
  src?: string | null
  metadata?: { src?: string | null }
}
