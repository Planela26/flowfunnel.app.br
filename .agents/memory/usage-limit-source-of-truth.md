---
name: Usage-limit source of truth
description: When de-duplicating two divergent usage counters, align enforcement with the metric the user-facing meter displays.
---

# Usage-limit source of truth

When a codebase enforces a plan/usage limit in two places with two different
underlying counts (e.g. one counts webhook-log "message" rows, another counts
distinct funnel "conversation_started" events), unify on the SAME metric that
the user-facing usage meter shows — not the semantically "ideal" one.

**Why:** In FlowFunnel the displayed meter (`GET /api/usage`) counts WhatsApp
`webhookLog` rows with `event='message'` for the month. A second enforcement
path counted distinct `funnelEvent` `whatsapp_conversation_started`. They could
diverge, so a user could see "500/1000 used" yet be blocked (or vice-versa). A
reviewer may push to "count unique conversations" as more correct, but if the
visible meter counts messages, enforcing on conversations reintroduces the very
inconsistency the de-dup task ("padronizar") is meant to remove.

**How to apply:** Before changing limit enforcement, find what the user-visible
usage/quota endpoint actually counts and make enforcement use the identical
query. Document the chosen single source of truth in a comment at both the
enforcement site and the display site.
