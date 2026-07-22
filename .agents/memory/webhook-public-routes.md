---
name: Webhook public routes
description: Webhook endpoints must be whitelisted in middleware or NextAuth blocks them with 401.
---

Any externally-called webhook endpoint must be listed in
`middleware.ts` → `publicApiRoutes`, otherwise the NextAuth middleware returns
401 before the route handler runs.

**Why:** `/api/webhooks/perfect-pay` was never added to the list, so both its
legacy and (new) tokenized routes silently 401'd. The other platforms worked
only because they were already whitelisted.

**How to apply:** the list is matched with a path-segment boundary check —
`pathname === route || pathname.startsWith(route + '/')` (NOT bare
`startsWith`, which would let `/api/authXYZ` impersonate `/api/auth`). Adding
the base path (e.g. `/api/webhooks/perfect-pay`) covers exact + tokenized
subpaths (`/api/webhooks/perfect-pay/<token>`). When adding a new webhook
platform, add its base path here. Same model applies to machine endpoints with
their own bearer auth (e.g. `/api/cron/snapshot`, `/api/cron/alerts`).
