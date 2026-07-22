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
