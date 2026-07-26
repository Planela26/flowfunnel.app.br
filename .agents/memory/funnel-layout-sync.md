---
name: FunnelFlow layout sync
description: Posições dos cards do FunnelFlow são persistidas no banco, não em localStorage
---
Posições dos cards do FunnelFlow persistem em `User.funnelLayout` (JSON) via `/api/funnel-layout`; localStorage é só cache de primeiro render.
**Why:** localStorage não sincroniza entre navegadores/dispositivos — usuário esperava mover no Opera e ver no Chrome.
**How to apply:** qualquer preferência de UI que deva seguir a conta (não o navegador) vai pro banco. Guardas: flag "hasLocalEdits" impede fetch tardio de sobrescrever movimentos; flush com sendBeacon no pagehide/unmount evita perder o save debounced de 5s.

**Visibility (visibleIds) é SAVE IMEDIATO — não debounced.** O bug que o usuário reportou (cards apagados voltam) tinha dois ingredientes:
1. Race condition no LOAD step 2: GET do servidor capturado, usuário clica X durante o in-flight, servidor retorna estado stale e sobrescreve a mudança do usuário. Correção: snapshotar `JSON.stringify(visibleIds)` no início do fetch; quando resolve, comparar contra `snapshot`. Se `serverJson !== snapshot` E `visibleIds !== snapshot` (usuário mexeu), NÃO aplicar servidor — manter a intenção do usuário e deixar o SAVE effect fazer POST.
2. Debounce de 600ms na escrita interagia com o cleanup acima: o timer pendente era morto quando visibleIds era re-setado pelo fetch resolution. add/remove-card são ações de baixa frequência (≤1/s) → POST imediato é seguro. Manter debounce só onde há updates frequentes (drag de posição).
