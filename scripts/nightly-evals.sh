#!/usr/bin/env bash
# Runs the model evals for each plugin group that has cases.
# The operator schedules this with launchd or cron under their own login.
set -euo pipefail
if [ -n "${ANTHROPIC_API_KEY:-}${ANTHROPIC_AUTH_TOKEN:-}${CI:-}" ]; then echo "nightly-evals: runs under a login on a workstation, not with a key or in CI" >&2; exit 2; fi
cd "$(dirname "$0")/.."
out="${REPORT_ROOT:-reports/evals}/$(date +%F)"
failed=0
for dir in plugins/*/; do
  g="$(basename "$dir")"
  if ! find "plugins/$g/evals" -name prompt.md -print -quit 2>/dev/null | grep -q .; then continue; fi
  claude plugin eval "plugins/$g" --trust-plugin --no-publish --threshold 0.67 --json "$out/$g.json" --output-dir "$out/$g" || failed=1
done
exit "$failed"
