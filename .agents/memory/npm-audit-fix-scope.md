---
name: npm audit fix drifts excluded chains
description: Why blanket `npm audit fix` is unsafe when a task forbids touching specific dependency chains.
---

# `npm audit fix` silently upgrades out-of-scope chains

`npm audit fix` (even without `--force`) will upgrade transitive dependency
chains that you were explicitly told NOT to touch, because it follows the
declared semver ranges. In FlowFunnel this meant a plain audit fix bumped the
whole WhatsApp/Baileys chain (`@whiskeysockets/baileys` rc.9 → rc13, switched
`libsignal` from the pinned git source to npm `^6`, bumped `protobufjs`, added
`whatsapp-rust-bridge`) and `jspdf` (4.1.0 → 4.2.1) — all of which were
out-of-scope due to WhatsApp QR / PDF-export breakage risk.

**Why:** Those advisories' only `fixAvailable` path runs through the excluded
chains. `ws`/`protobufjs`/`libsignal` are reachable only via Baileys; `dompurify`
only via jsPDF. So "fixing" them necessarily upgrades the forbidden parent.

**How to apply:** When a task pins/excludes a dependency chain, do NOT run
blanket `npm audit fix`. Instead trace each advisory with
`npm ls <pkg> --all` first; only fix advisories whose entire path is outside the
excluded chains (and prefer a narrow `overrides` pin over a parent upgrade). If
every fixable advisory lands in an excluded chain, the correct outcome is to
keep the baseline and document the residual risk — not to upgrade.

A code review will (correctly) reject lockfile drift on excluded packages even
if `package.json` is unchanged, because the review diffs against the task base,
not HEAD. If drift was already committed in a checkpoint, restore the base
lockfile with `git show <base>:package-lock.json > package-lock.json` (read-only
git, allowed) then `npm install` to reconcile.
