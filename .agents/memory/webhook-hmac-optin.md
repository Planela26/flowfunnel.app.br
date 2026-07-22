---
name: Platform webhooks are fail-closed (HMAC required)
description: Eduzz/Kiwify/Monetizze/Perfect Pay webhooks now require their *_WEBHOOK_SECRET (fail-closed via guardWebhook requireSecret); missing secret rejects with 503.
---

# Platform webhooks: fail-closed HMAC

The platform webhooks (Eduzz, Kiwify, Monetizze, Perfect Pay) are **fail-closed**.
Each route (legacy + `[token]`) passes `requireSecret: true` to `guardWebhook`
(`lib/webhook-security.ts`). When the matching `*_WEBHOOK_SECRET` env is missing/empty,
the guard **does not process**, **logs an alert** (`🚨 [webhook-security] ALERTA`),
and returns **HTTP 503**. When the secret exists, HMAC is mandatory (missing/invalid
signature → 403).

**Why:** previously the guard only enforced HMAC when the secret happened to be set
(fail-OPEN) — an unset secret silently accepted unsigned payloads, letting anyone who
found the URL inject fake "sales". This was finding F2 of the pre-launch audit.

**How to apply:**
- The `[token]` routes are **auth-first**: `guardWebhook` runs BEFORE
  `findIntegrationByWebhookToken` (the secret is env-based, not per-integration), so an
  invalid token + missing secret returns 503 without a DB hit (reduces enumeration).
- Stripe and Mercado Pago have their own independent fail-closed verification.
- Hotmart is intentionally different: primary auth is the per-tenant `hottok` header
  (403 if absent), with HMAC optional — so it passes `secret: null` (no `requireSecret`).
- Status report: `npx tsx scripts/webhook-protection-report.ts` → `WEBHOOK_SECURITY_REPORT.md`.
- Test: `npx tsx __tests__/webhook-failclosed.test.ts` (9/9).
- Operational gotcha: until each `*_WEBHOOK_SECRET` is actually configured, that route
  rejects ALL calls (503). Set the secrets for the platforms the customer uses.
