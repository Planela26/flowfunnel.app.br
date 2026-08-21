/**
 * Versão da Graph API da Meta, em um lugar só.
 *
 * Estava cravada como `v18.0` em 21 pontos espalhados por 7 arquivos — Ads,
 * WhatsApp, telas de conexão e rotas de teste. Trocar a versão significava
 * caçar todas, e esquecer uma deixava parte do sistema falando uma língua
 * diferente do resto, sem nada denunciar.
 *
 * Por que isso importa: a Meta mantém cada versão por cerca de dois anos. A
 * v18.0 é de setembro de 2023. Passado o prazo, as chamadas NÃO começam a
 * falhar — elas passam a ser atendidas silenciosamente pela versão mais antiga
 * ainda suportada, com as diferenças de campo e de comportamento que houver.
 * O resultado é um sistema que roda numa versão que ninguém escolheu e que
 * muda sozinha, produzindo justamente as inconsistências difíceis de explicar:
 * a mesma consulta responde num lugar e vem vazia em outro.
 *
 * Como verificar qual é a atual, sem token:
 *
 *   curl -s https://graph.facebook.com/v27.0/me
 *
 * Versão existente responde "An active access token must be used" (code 2500).
 * Versão inexistente responde "Unknown path components: /me". Foi assim que a
 * v26.0 foi confirmada como a mais nova em agosto de 2026.
 *
 * Ao subir a versão: conferir o changelog da Meta para campos removidos, e
 * testar Ads (insights, campanhas) e WhatsApp (envio, templates) — os dois
 * usam esta constante e evoluem em ritmos diferentes.
 */
export const GRAPH_API_VERSION = 'v26.0'

/** Base completa: `https://graph.facebook.com/v26.0` */
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`
