/**
 * Interruptor do rastreamento de Landing Page.
 *
 * O rastreador de site saiu do ar em 01/10/2026 para ser retrabalhado fora do
 * caminho de quem usa a plataforma. Ele media errado — dados de um funil
 * apareciam no outro — e número errado é pior que número nenhum: quem vê uma
 * visita que não existe decide em cima dela.
 *
 * O QUE ESTE INTERRUPTOR FAZ: tira o rastreamento de tudo que a pessoa vê —
 * o card no funil, o item no menu, a busca de métricas no dashboard e o que a
 * Sara.AI comenta. Um lugar só, para a volta ser trocar `false` por `true`.
 *
 * O QUE ELE NÃO FAZ, DE PROPÓSITO:
 *
 * - não desliga `/api/track/*`. Quem já colou o `tracker.js` no próprio site
 *   continua enviando, e os dados continuam sendo guardados. Desligar
 *   quebraria o site de quem instalou, em silêncio, e ainda perderia o
 *   histórico que vai servir para conferir o rastreador novo contra o antigo.
 * - não apaga nada do banco.
 * - não tira a página `/rastreamento` do ar. Ela sai do menu, mas continua
 *   acessível pelo endereço direto — é onde o trabalho de conserto acontece.
 */
export const RASTREAMENTO_LANDING_ATIVO = false
