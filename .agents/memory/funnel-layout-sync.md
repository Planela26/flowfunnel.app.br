---
name: FunnelFlow layout sync
description: Posições dos cards do FunnelFlow são persistidas no banco, não em localStorage
---
Posições dos cards do FunnelFlow persistem em `User.funnelLayout` (JSON) via `/api/funnel-layout`; localStorage é só cache de primeiro render.
**Why:** localStorage não sincroniza entre navegadores/dispositivos — usuário esperava mover no Opera e ver no Chrome.
**How to apply:** qualquer preferência de UI que deva seguir a conta (não o navegador) vai pro banco. Guardas: flag "hasLocalEdits" impede fetch tardio de sobrescrever movimentos; flush com sendBeacon no pagehide/unmount evita perder o save debounced de 5s.
