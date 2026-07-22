#!/bin/bash
# Apply pending Prisma migrations.
#
# This wrapper handles the one-time transition from `prisma db push` (the
# previous schema-rollout mechanism in this project) to `prisma migrate deploy`.
# On environments where the schema already exists but the `_prisma_migrations`
# ledger is empty, Prisma errors with P3005. In that case we baseline the
# existing schema by marking the `0_baseline` migration as applied (without
# running it) and then re-run `migrate deploy` so subsequent additive
# migrations (e.g. 20260502000000_add_metric_snapshot_gasto) are applied.
#
# All shipped migrations are idempotent (`IF NOT EXISTS`) so a re-run on an
# already-up-to-date database is safe.
set -eo pipefail

OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT

set +e
npx prisma migrate deploy >"$OUT" 2>&1
STATUS=$?
set -e
cat "$OUT"

if [ "$STATUS" -eq 0 ]; then
  exit 0
fi

if grep -q "P3005" "$OUT"; then
  echo ">> Detected non-baselined existing schema; resolving baseline and retrying."
  npx prisma migrate resolve --applied 0_baseline
  npx prisma migrate deploy
  exit 0
fi

echo ">> Migration deploy failed for an unhandled reason." >&2
exit "$STATUS"
