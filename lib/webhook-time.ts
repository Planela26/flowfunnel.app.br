/**
 * Data de um evento de webhook, sem depender da unidade que a plataforma usou.
 *
 * A Hotmart 2.0.0 manda `approved_date` em MILISSEGUNDOS (1622948400000). O
 * código multiplicava por 1000 assumindo segundos, e a venda era gravada no
 * ano ~50.000. Ela continuava aparecendo em consultas do tipo `timestamp >= X`
 * — por isso o defeito não saltava aos olhos — mas quebrava qualquer gráfico,
 * qualquer ordenação por data e qualquer janela com limite superior.
 *
 * Em vez de cravar a unidade de cada plataforma (e errar de novo quando uma
 * delas mudar), a unidade é deduzida da grandeza do número:
 *
 *   1e11 em milissegundos = março de 1973
 *   1e11 em segundos      = ano 5138
 *
 * Nenhuma venda real cai entre esses dois pontos, então o limiar separa as duas
 * unidades sem ambiguidade.
 *
 * O que não for reconhecível vira `agora` — datar no presente é impreciso, mas
 * datar em 50.000 é corrupção de dado.
 */

const LIMIAR_MS = 1e11

/**
 * Valor de uma compra da Hotmart.
 *
 * A 2.0.0 manda TRÊS objetos de preço e nenhum é garantido:
 *
 *   purchase.price               valor da oferta no momento da compra
 *   purchase.full_price          total pago pelo comprador, com taxas e juros
 *   purchase.original_offer_price valor da oferta principal
 *
 * O código lia só o primeiro e gravava 0 quando ele não vinha — uma venda
 * registrada com faturamento zerado, que é pior do que não registrar, porque
 * derruba o ticket médio e o faturamento de todo o período junto.
 *
 * A ordem abaixo é deliberada: `price` é o que a oferta custou, que é o que o
 * produtor entende por "valor da venda". `full_price` inclui juros de
 * parcelamento, então só entra quando o primeiro não veio.
 */
export function valorDaCompra(purchase: any): { valor: number; moeda: string | null; campo: string | null } {
  const candidatos: [string, any][] = [
    ['price', purchase?.price],
    ['full_price', purchase?.full_price],
    ['original_offer_price', purchase?.original_offer_price],
  ]
  for (const [campo, obj] of candidatos) {
    const n = Number(obj?.value)
    if (Number.isFinite(n) && n > 0) {
      return { valor: n, moeda: obj?.currency_value ?? null, campo }
    }
  }
  return { valor: 0, moeda: null, campo: null }
}

export function dataDeWebhook(valor: unknown, agora: Date = new Date()): Date {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? agora : valor

  // ISO 8601 é aceito direto; algumas plataformas mandam string de data.
  if (typeof valor === 'string' && !/^\d+$/.test(valor.trim())) {
    const d = new Date(valor)
    return plausivel(d) ? d : agora
  }

  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return agora

  const d = new Date(n >= LIMIAR_MS ? n : n * 1000)
  return plausivel(d) ? d : agora
}

/**
 * Guarda final: mesmo com a unidade certa, um valor corrompido na origem não
 * deve entrar no banco. 2000–2100 cobre com folga qualquer venda real.
 */
function plausivel(d: Date): boolean {
  if (Number.isNaN(d.getTime())) return false
  const ano = d.getUTCFullYear()
  return ano >= 2000 && ano <= 2100
}
