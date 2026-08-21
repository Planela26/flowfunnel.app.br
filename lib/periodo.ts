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
/**
 * Períodos oferecidos nas telas, em um lugar só.
 *
 * Nasceu dentro de app/dashboard/page.tsx e subiu para cá quando a aba
 * Analytics revelou o custo de ter listas separadas: lá o estado guardava
 * `'last7days'` enquanto o seletor emitia `'7days'`, então nenhum clique
 * casava e o período parecia travado. Vocabulário duplicado sempre diverge;
 * a única defesa é não duplicar.
 *
 * `meta` é o `date_preset` da Graph API, `dias` é o que as rotas de métricas
 * esperam em `?days=`, e `comparacao` é o vocabulário próprio de
 * /api/analytics/comparison, que não tem equivalente para hoje/ontem.
 */
export const PERIODOS = [
  { valor: 'today',     rotulo: 'Hoje',             meta: 'today',     dias: 1,   comparacao: '7d'  },
  { valor: 'yesterday', rotulo: 'Ontem',            meta: 'yesterday', dias: 2,   comparacao: '7d'  },
  { valor: '7days',     rotulo: 'Últimos 7 dias',   meta: 'last_7d',   dias: 7,   comparacao: '7d'  },
  { valor: '30days',    rotulo: 'Últimos 30 dias',  meta: 'last_30d',  dias: 30,  comparacao: '30d' },
  { valor: '90days',    rotulo: 'Últimos 90 dias',  meta: 'last_90d',  dias: 90,  comparacao: '90d' },
  { valor: 'maximum',   rotulo: 'Desde o início',   meta: 'maximum',   dias: 365, comparacao: '90d' },
] as const

/** Sempre devolve algo: valor desconhecido cai em "Últimos 7 dias". */
export const periodoPor = (valor: string) =>
  PERIODOS.find(p => p.valor === valor) ?? PERIODOS[2]

/** Opções no formato que o DateFilter espera. */
export const opcoesDePeriodo = () =>
  PERIODOS.map(p => ({ value: p.valor, label: p.rotulo }))

export function desdeQuando(request: Request, padraoEmDias = 30): Date {
  const bruto = new URL(request.url).searchParams.get('days')
  const pedido = parseInt(bruto || '', 10)
  // Teto de 365: janela maior não é oferecida na interface e só serviria para
  // varrer a tabela inteira a partir de um parâmetro do cliente.
  const dias = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 365) : padraoEmDias
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
}
