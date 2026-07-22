---
name: Webhook multi-tenant routing
description: How checkout webhooks (Hotmart/Kiwify/Eduzz/Monetizze/Perfect Pay) resolve the correct tenant without cross-tenant leakage.
---

Checkout webhooks must never attribute an incoming event to an arbitrary
"first active integration" — that leaks one tenant's sales into another's funnel.

**Rule:**
- Primary path is tokenized: `/api/webhooks/<platform>/[token]`, where `token` is
  `Integration.webhookToken` (unique). Lookup by token → exact tenant.
- Legacy untokenized URLs are kept for backwards compatibility but must be safe:
  - Hotmart: identify tenant by the `X-Hotmart-Hottok` header matched against
    `Integration.accessToken`. Uniqueness is NOT enforced in the DB, so fetch up
    to 2 matches and return 409 (ambiguous) if more than one — never guess.
  - Others (no per-user payload identifier): process only if exactly one active
    integration exists for the platform; otherwise return 409 and require the
    tokenized URL.

**Why:** the original code did `findFirst({ platform })` and attached every
webhook to whichever tenant happened to be first — a cross-tenant data leak.

**How to apply:** helpers live in `lib/webhook-tenant.ts`
(`findIntegrationByWebhookToken`, `findSingleActiveIntegration`,
`findHotmartIntegrationByHottok`, `ensureWebhookToken`, `buildWebhookUrl`).
Shared event processors are in `lib/webhook-handlers.ts` so tokenized and legacy
routes share logic; tenant resolution + signature checks stay at the route layer.
