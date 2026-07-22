---
name: Bulk-refactor dedup parity
description: Preserving exact dedup semantics when converting per-row DB loops into bulk in-memory evaluation.
---

# Keep dedup parity when de-N+1-ing a loop

When refactoring a cron/job that did, per row, `findFirst(exists?) -> create`,
into a bulk pattern (one upfront `findMany`/`groupBy`, then in-memory eval):

- Build the "already exists" set **once** from the upfront query, AND **update
  that set after each successful write** within the same run.
- Only update the set on an actual write. In a `dryRun` (no writes), do not add
  to the set — this mirrors the original, where `findFirst` only saw rows that
  were really persisted.

**Why:** The original per-row check saw writes made earlier in the same run. A
bulk version that snapshots existence once and never updates it can create
duplicates if two iterations resolve to the same dedup key in one run.

**How to apply:** Whenever you replace a findFirst-then-create loop with a
pre-fetched `Set`, add `seen.add(key)` right after the create, inside the
non-dry-run branch.
