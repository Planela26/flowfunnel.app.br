/**
 * Cabeçalhos CORS para os endpoints públicos de rastreamento.
 *
 * Estes endpoints são chamados pelo `tracker.js` instalado no site do cliente,
 * ou seja, SEMPRE de outra origem. Por isso são deliberadamente abertos.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO SERVE `Access-Control-Allow-Origin: '*'`
 *
 * O tracker envia os eventos por `navigator.sendBeacon`, que é a forma certa:
 * ele sobrevive ao fechamento da aba, que é justamente quando o último evento
 * da visita acontece.
 *
 * Só que o `sendBeacon` manda COOKIES junto — é uma requisição credenciada. E
 * o navegador RECUSA `Allow-Origin: *` em requisição credenciada, por regra da
 * especificação. O preflight passava (ele não leva credencial) e a requisição
 * real morria com "CORS error".
 *
 * O efeito era total e silencioso: o script carregava, aparecia 200 na aba
 * Rede do preflight, e NENHUM evento chegava. Todo site de cliente com o
 * rastreador instalado estava nessa situação.
 *
 * A correção é ecoar a origem que pediu e declarar que credencial é aceita.
 * Não afrouxa nada: `*` já significava "qualquer origem", e o endpoint é
 * público por natureza — quem o chama é o site do cliente, que pode ser
 * qualquer domínio.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function corsPublico(request: Request): Record<string, string> {
  const origem = request.headers.get('origin')
  return {
    // Sem `Origin` (chamada direta, curl, healthcheck) o `*` volta a servir:
    // não há credencial em jogo e não há origem para ecoar.
    'Access-Control-Allow-Origin': origem || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    // Obrigatório com origem ecoada: sem isto, um proxy pode servir a resposta
    // de um domínio para outro, e aí o CORS quebra de forma intermitente —
    // o pior tipo de falha para diagnosticar.
    Vary: 'Origin',
  }
}
