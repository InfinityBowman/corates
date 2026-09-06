#!/usr/bin/env bash
# Run the Playwright suite the way CI does: a full pass, then a healing pass
# over a handful of failures, then a Markdown job summary.
#
# The healing pass re-runs failed specs after the rest of the suite has
# finished, so they get a quiet staging and a fresh seed. It is capped at a
# few failures: a broad failure is a real break, and re-running fourteen
# three-minute timeouts would only delay the red.
#
# Run from packages/web. Writes to $GITHUB_STEP_SUMMARY when set.

set -u

MAX_HEALABLE=${E2E_MAX_HEALABLE:-3}
FIRST_PASS_DIR=test-results-first-pass

rm -rf "$FIRST_PASS_DIR"

pnpm test:e2e
status=$?

if [ "$status" -ne 0 ] && [ -f test-results/.last-run.json ]; then
  failed=$(node -p "JSON.parse(require('fs').readFileSync('test-results/.last-run.json','utf8')).failedTests.length")
  if [ "$failed" -gt 0 ] && [ "$failed" -le "$MAX_HEALABLE" ]; then
    echo "::notice::$failed test(s) failed; re-running them once after the suite"
    mv test-results "$FIRST_PASS_DIR"
    pnpm test:e2e --last-failed --last-failed-file "$FIRST_PASS_DIR/.last-run.json"
    status=$?
  else
    echo "::notice::$failed tests failed; skipping the healing pass"
  fi
fi

summary=$(node scripts/e2e-summary.mjs "$FIRST_PASS_DIR/results.json" test-results/results.json)
echo "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "$summary" >> "$GITHUB_STEP_SUMMARY"
fi

exit "$status"
