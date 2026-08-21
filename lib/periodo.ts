/**
 * Janela de tempo pedida pela requisição.
 *
 * O seletor de período do dashboard alimentava só os cards de mídia paga. Os de
 * checkout (Hotmart, Kiwify, Eduzz, Monetizze) e o do WhatsApp cravavam 30 dias
 * no código e ignoravam a escolha — então trocar para "Hoje" mudava metade da
 * tela e deixava a outra metade nos mesmos números. Duas janelas diferentes
 * lado a lado, sem nada indicando isso, é pior do que uma janela fixa: leva a
 * comparar coisas que não são comparáveis.
 *
 * `?days=` é o parâmetro; 30 continua sendo o padrão de quem não informa, para
 * não mudar o comportamento de chamador antigo.
 */
export function desdeQuando(request: Request, padraoEmDias = 30): Date {
  const bruto = new URL(request.url).searchParams.get('days')
  const pedido = parseInt(bruto || '', 10)
  // Teto de 365: janela maior não é oferecida na interface e só serviria para
  // varrer a tabela inteira a partir de um parâmetro do cliente.
  const dias = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 365) : padraoEmDias
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
}
