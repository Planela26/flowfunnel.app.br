---
name: funnel-onboarding-seed
description: Padrão pra funil aparecer com cards visíveis já no primeiro login — seed no register + tutorial do board.
---

O funil só era criado na chegada do primeiro webhook (`ensureFunnelWithStages` em `lib/webhook-stages.ts`). Conta nova entrava no dashboard sem cards até bater integração de Meta/Google/TikTok — ruim pra UX.

**Padrão adotado** (jun/2026): chamar `ensureFunnelWithStages(user.id)` dentro de `app/api/auth/register/route.ts` logo após criar o `EmailVerificationToken`, antes de retornar o `NextResponse`. Idempotente (a função não recria se já existe), portanto é seguro chamar em todo signup.

Cards aparecem em colunas (Lead → Qualificado → Checkout → Pago no topo, Recusado/Reembolsado/Chargeback/Abandonado embaixo), e o usuário pode arrastar/clique/editar livremente. As posições são salvas em `User.funnelLayout` (JSON sync via `/api/funnel-layout`).

**Why:** Antes, o "período virtuoso" entre o signup e o primeiro webhook mostrava um dashboard vazio. O usuário interpretava como bug. Com o seed imediato o board já tem cara de produto funcional e o CTA de "primeira integração" de cima fica mais crível.

**How to apply:** Toda vez que uma nova entidade-mãe precisar estar visível ao usuário desde o primeiro acesso, semeie no mesmo bloco de transação do signup. Não delegar pra webhook-side-effects: webhook é assíncrono e pode falhar silenciosamente.
