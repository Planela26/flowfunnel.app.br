# Auditoria de Eventos Meta Pixel — FlowFunnel
**Data:** 2026-06-07  
**Pixels auditados:** `2203835897111572` · `1499523888575243`

---

## Resumo Executivo

| Critério | Status |
|---|---|
| PageView em ambos os pixels | ✅ Implementado |
| Lead | ❌ Ausente |
| CompleteRegistration | ❌ Ausente |
| StartTrial | ❌ Ausente |
| InitiateCheckout | ❌ Ausente |
| Purchase (pixel client-side) | ❌ Ausente |
| Purchase (CAPI server-side) | ❌ Ausente |
| Deduplicação Pixel ↔ CAPI | ❌ Impossível sem CAPI |
| Purchase apenas após pagamento real | ⚠️ N/A — evento não existe |
| Valores corretos no Purchase | ⚠️ N/A — evento não existe |
| Advanced Matching (email/telefone hash) | ❌ Ausente |

**Score: 1/11 critérios atendidos.**

---

## 1. PageView ✅

**Onde:** `app/layout.tsx` (carregamento inicial) + `components/MetaPixelTracker.tsx` (navegação SPA).

```js
// layout.tsx — init dos dois pixels + PageView inicial
fbq('init', '2203835897111572');
fbq('init', '1499523888575243');
fbq('track', 'PageView');

// MetaPixelTracker — dispara a cada troca de rota no App Router
window.fbq('track', 'PageView')
```

**Ambos os pixels recebem o evento** — quando `fbq('track', 'PageView')` é chamado após dois `fbq('init', ...)`, o SDK envia para os dois automaticamente.

---

## 2. Lead ❌

**Onde deveria disparar:** quando o visitante preenche um formulário de captura (landing page, formulários de contato).

**Situação atual:** nenhum `fbq('track', 'Lead')` existe no código.  
O tracker interno (`/api/track/event`) captura leads da landing page, mas **não repassa o evento para o Pixel**.

---

## 3. CompleteRegistration ❌

**Onde deveria disparar:** após o usuário criar conta com sucesso.

**Situação atual:** `app/api/auth/register/route.ts` retorna `{ id, email, name }` ao client — **nenhum `fbq('track', 'CompleteRegistration')` é disparado** na página de registro (`app/register/page.tsx`) nem no backend.

---

## 4. StartTrial ❌

**Onde deveria disparar:** quando um usuário ativa o trial de 7 dias (registro com `?plan=START|PRO|SCALE`).

**Situação atual:** o trial é ativado em `app/api/auth/register/route.ts` (seta `trialEndsAt` + `trialPlan`). Nenhum evento Pixel ou CAPI é enviado nesse momento.

---

## 5. InitiateCheckout ❌

**Onde deveria disparar:** quando o usuário abre a página de checkout (`/checkout?plan=...`).

**Situação atual:** `app/checkout/page.tsx` renderiza o Payment Brick do Mercado Pago e o embedded checkout do Stripe — **nenhum `fbq('track', 'InitiateCheckout')` existe no arquivo**.

---

## 6. Purchase ❌

### 6a. Client-side (Pixel)

**Onde deveria disparar:** página `/checkout/success` após confirmação.

**Situação atual:** `app/checkout/success/page.tsx` apenas exibe mensagem de sucesso e redireciona ao dashboard. **Nenhum `fbq('track', 'Purchase')` existe.**

> ⚠️ **Risco de disparo antecipado:** a página `/checkout/success` é acessada imediatamente após o submit do Brick, **antes** de o webhook do Stripe/MercadoPago confirmar o pagamento. Se o evento Purchase for disparado aqui, ele pode ser enviado mesmo para pagamentos que ainda não foram confirmados (PIX pendente, boleto, falha de cartão). O local correto para Purchase confiável é o **servidor** via CAPI, disparado dentro do webhook `invoice.paid` (Stripe) ou `payment.status === 'approved'` (MercadoPago).

### 6b. Server-side (CAPI)

**Situação atual:** inexistente — ver seção 7.

---

## 7. Conversion API (CAPI) ❌

**Situação atual:**

- A variável `META_ACCESS_TOKEN` existe no ambiente mas está **vazia** (`""`).
- **Não existe nenhuma chamada** a `https://graph.facebook.com/vXX.0/{PIXEL_ID}/events` em todo o codebase.
- As chamadas existentes a `graph.facebook.com` são exclusivamente para WhatsApp Business API e Meta Ads Insights — **não são CAPI**.

**O que a CAPI precisaria:**
1. `META_ACCESS_TOKEN` preenchido (token de acesso do sistema do Business Manager).
2. Um `PIXEL_ID` (qualquer um dos dois, ou ambos).
3. Uma função server-side `sendCAPIEvent(eventName, userData, customData, eventId)` chamada nos webhooks de pagamento e no registro.

---

## 8. Deduplicação Pixel ↔ CAPI ❌

**Situação atual:** impossível enquanto a CAPI não estiver implementada.

**Como funciona quando implementado:** o mesmo `event_id` UUID deve ser gerado no servidor, enviado via CAPI e também passado no `fbq('track', ..., { eventID: uuid })` do client. O Meta usa o `event_id` para deduplicar automaticamente se receber os dois (Pixel + CAPI) para o mesmo evento.

---

## 9. Advanced Matching ❌

**Situação atual:** `fbq('init', 'PIXEL_ID')` é chamado sem nenhum objeto de dados de usuário.

**Como deveria ser:** quando o usuário está logado (sessão ativa), o email em hash SHA-256 (e opcionalmente telefone) deve ser passado no init ou em cada evento:

```js
fbq('init', 'PIXEL_ID', {
  em: sha256(email.toLowerCase().trim()),  // hash SHA-256 do email
  ph: sha256(phone),                        // hash do telefone (opcional)
})
```

Isso aumenta significativamente a taxa de match de eventos com perfis do Facebook, melhorando o ROAS reportado.

---

## 10. Valores do Purchase ⚠️

**Situação atual:** sem o evento Purchase, os valores não são enviados. Quando implementado:

| Plataforma | Fonte do valor | Campo disponível |
|---|---|---|
| Stripe | `invoice.paid` webhook | `invoice.amount_paid / 100` (R$) |
| MercadoPago | webhook `approved` | `payment.transaction_amount` (R$) |
| Currency | Ambas | `BRL` |

Os valores já estão corretamente acessíveis nos webhooks server-side.

---

## 11. Mapa de Implementação Recomendada

```
Evento              | Pixel (client)                    | CAPI (server)
──────────────────────────────────────────────────────────────────────
PageView            | ✅ layout.tsx + Tracker           | — (não necessário)
Lead                | app/register/page.tsx             | api/auth/register/route.ts
CompleteRegistration| app/register/page.tsx (on success)| api/auth/register/route.ts
StartTrial          | app/register/page.tsx (on success)| api/auth/register/route.ts
InitiateCheckout    | app/checkout/page.tsx (on mount)  | — (client é suficiente)
Purchase            | app/checkout/success/page.tsx*    | api/stripe/webhook + api/webhooks/mercadopago
                    | (*apenas após webhook confirmar)  | (único ponto confiável)
```

> Para Purchase, a fonte da verdade é sempre o webhook server-side. O disparo no `/checkout/success` é aceitável apenas como sinal complementar (com `event_id` para deduplicar com o CAPI).

---

## 12. Próximos Passos Prioritários

| Prioridade | Ação |
|---|---|
| 🔴 Alta | Implementar CAPI — configurar `META_ACCESS_TOKEN` + função `sendCAPIEvent` |
| 🔴 Alta | `Purchase` via CAPI nos webhooks Stripe (`invoice.paid`) e MercadoPago (`approved`) |
| 🟠 Média | `CompleteRegistration` + `StartTrial` no registro |
| 🟠 Média | `InitiateCheckout` na abertura do checkout |
| 🟡 Baixa | Advanced Matching nos pixels (email hash do usuário logado) |
| 🟡 Baixa | `Lead` na landing page (requer integração com tracker existente) |
