'use strict'

/**
 * Preload — roda antes da página, no único ponto que enxerga os dois lados.
 *
 * Está deliberadamente VAZIO de API: nada de `ipcRenderer`, nada de acesso a
 * arquivo, nada exposto em `window`. O app é uma página web comum e não precisa
 * de nada do sistema; abrir uma ponte "para o caso de precisar" só criaria
 * superfície de ataque para um conteúdo que vem da rede.
 *
 * O arquivo existe porque `contextIsolation: true` com `sandbox: true` pede um
 * preload declarado, e porque é aqui que uma necessidade futura (notificação
 * nativa, por exemplo) entraria — de forma controlada, uma função por vez.
 */

// Marca só para a página saber que está rodando dentro do programa, e poder
// esconder coisas que não fazem sentido ali (como "instale o app").
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('data-flowsara-desktop', '1')
})
