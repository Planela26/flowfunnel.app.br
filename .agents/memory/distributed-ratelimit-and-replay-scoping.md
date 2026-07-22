---
name: Distributed rate-limit & webhook replay scoping
description: Why rate-limit keys and webhook replay fingerprints must carry tenant context once they are backed by shared Postgres state.
---

# Distributed rate-limit keys must be tenant-scoped

When `checkRateLimit` moved from per-instance in-memory state to shared Postgres
(atomic `INSERT ... ON CONFLICT`), any **globally-keyed** limiter became a
cross-tenant outage vector: one noisy tenant exhausts the shared counter and
everyone gets 429. In-memory RL hid this because each instance had its own map.

**Rule:** every authenticated rate-limit key must include the principal
(`...:${session.user.id}`, fallback IP). Fetch the session BEFORE calling
`checkRateLimit` so the key can be user-scoped. Webhook limiters are keyed by the
per-tenant token (`webhook:kiwify:${token}`), which is already tenant-safe.

**Why:** shared state turns a global key into a single bucket for all tenants.
**How to apply:** when adding/auditing rate limits on auth-gated routes, key by
user id; never reuse a constant string like `integrations:meta:post`.

# Webhook replay fingerprint must include the tenant for tokenized routes

`guardWebhook` dedups on `unique([platform, signatureFingerprint])` where the
fingerprint falls back to the raw body when no HMAC signature is present. For
tokenized multi-tenant webhooks (`/api/webhooks/<plat>/[token]`), pass
`platform: \`<plat>:${token}\`` so two different tenants posting an identical
body are not collapsed — otherwise the second tenant's legitimate event is
silently suppressed as a duplicate.

**Why:** identical bodies across tenants collide in a platform-only key space.
**How to apply:** legacy single-tenant routes keep the bare platform string;
every `[token]` route must fold the token into the `platform` field.
