---
name: Hostinger deployment caches on empty commits
description: Hostinger Cloud (hPanel "Implantações") skips rebuild on empty commits and serves cached chunks from hcdn; real file diff is needed to force a fresh CDN-bypassed build.
---
**Rule:** Force a Hostinger deployment rebuild by pushing a real source change, not an empty commit.

**Why:** On a Next.js 16 + Turbopack project deployed to Hostinger's "Implantações", pushing an empty commit (`git commit --allow-empty -m "trigger redeploy" && git push`) did NOT trigger a fresh build. The hcdn edge cache continued serving the prior chunk filesystem (`x-hcdn-cache-status: HIT`, `last-modified` stuck on the old build). The Hostinger panel doesn't always expose a "Limpar cache" / "Flush cache CDN" button — when it does not, the only reliable workaround is to commit an actual file change so Turbopack regenerates chunks with new content hashes that the CDN has not yet cached. Confirmed: appending a `/* ... */` comment to `components/FunnelFlow.tsx` and pushing produced fresh chunks (`last-modified` updated) the moment Hostinger rebuilt.

**How to apply:** When the user reports "I pushed but production still serves old code" against Hostinger Implantações, before suggesting another empty commit:
1. Confirm the chunk filesystem is unchanged by checking `git rev-parse HEAD` against `git ls-remote origin HEAD` and by fetching one chunk URL twice — once normally (`x-hcdn-cache-status: HIT` expected) and once with `?nocache=$(date +%s%N)` (`MISS` expected). If even the MISS-fetched chunk lacks the new markers, content is genuinely stale.
2. If there is no "Limpar cache" / "Flush CDN" button in the deployment detail view, push a real diff — even an inert comment line in a client-component file is enough. Turbopack regenerates chunks with new content hashes, so hcdn has nothing cached under those URLs.
3. After Hostinger finishes the rebuild, verify with a bypass-cache fetch on the (now-renamed) chunk URL and grep for the new marker strings.

**Related:** `csp-edge-nonce.md` (CSP/Next.js pitfalls), `npm-audit-fix-scope.md` (don't blanket `npm audit fix` on Hostinger — npm install is part of every build and may pull in unexpected upgrades).
