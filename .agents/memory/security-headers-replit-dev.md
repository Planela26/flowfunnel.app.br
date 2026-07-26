---
name: Security headers gating on Replit dev preview
description: Why HSTS and X-Frame-Options must be production-only in this app
---

Gate `X-Frame-Options: SAMEORIGIN` and `Strict-Transport-Security` to
`NODE_ENV === 'production'` in `middleware.ts` `withCsp()`.

**Why:** the Replit dev preview renders the app inside a cross-origin iframe on a
`*.replit.dev` host. `X-Frame-Options: SAMEORIGIN` would block that iframe and the
preview goes blank in dev. HSTS on the dev host is also undesirable (caches HTTPS
upgrade per host). In dev, framing is already controlled by the CSP
`frame-ancestors` directive (which whitelists the Replit dev domains).

**How to apply:** always-on headers (nosniff, Referrer-Policy, Permissions-Policy,
X-DNS-Prefetch-Control) are safe in both envs; framing/HSTS go behind the prod
check. Validate header behavior on the published app, not only the preview.

**Regression 2026-07-26:** the same HSTS+SAMEORIGIN pair was ALSO listed in
`next.config.js` `SECURITY_HEADERS` and emitted by `next.config` `headers()`
unconditionally. `next.config` headers are applied BEFORE the middleware runs,
so the `isProd` gate in `middleware.ts` had no effect and the headers still
leaked in dev. Symptom: Opera refused to clear cookies via Ctrl+Shift+Del
after the first visit (HSTS preload pins the host to HTTPS for 2 years,
and Opera preserves cookies on HSTS-pinned hosts through "clear browsing
data"); Chrome tolerated it. Fix: keep only always-true headers in
`SECURITY_HEADERS`; rely on middleware for prod-only framing/HSTS.
