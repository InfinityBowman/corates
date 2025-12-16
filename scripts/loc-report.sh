#!/usr/bin/env bash
set -euo pipefail

# LOC report script
# Usage:
#   ./scripts/loc-report.sh           # total + per top-level + per package in packages/
#   ./scripts/loc-report.sh packages  # only packages/* breakdown
#   ./scripts/loc-report.sh web      # only the "web" top-level dir

command -v git >/dev/null 2>&1 || { echo "git not found in PATH" >&2; exit 2; }
command -v cloc >/dev/null 2>&1 || { echo "cloc not found in PATH. Install it: https://github.com/AlDanial/cloc" >&2; exit 2; }

TMP_TRACKED=$(mktemp)
trap 'rm -f "$TMP_TRACKED"' EXIT

# Gather tracked files (one per line), excluding common lock files
# (pnpm-lock.yaml, package-lock.json, yarn.lock) which are tracked but not source
git ls-files -z | tr '\0' '\n' | grep -vE '(^|/)(pnpm-lock.yaml|package-lock.json|yarn.lock)$' > "$TMP_TRACKED"

if [ ! -s "$TMP_TRACKED" ]; then
  echo "No tracked files found." >&2
  exit 1
fi

print_header() {
  echo
  echo "==========================================="
  echo "$1"
  echo "==========================================="
}

# Total (tracked files)
print_header "Total (Git-tracked files)"
cloc --list-file="$TMP_TRACKED" --quiet || true

# Helper to run cloc on a subset list
run_subset() {
  local label="$1" filelist="$2"
  if [ ! -s "$filelist" ]; then
    return
  fi
  printf "\n--- %s (%s files) ---\n" "$label" "$(wc -l < "$filelist")"
  cloc --list-file="$filelist" --quiet || true
}

# Only show per-package breakdown (packages/*) — avoid per-top-level dirs like docs
if grep -q '^packages/' "$TMP_TRACKED"; then
  print_header "Per package (packages/*)"
  packages=$(awk -F/ '$1=="packages"{print $2}' "$TMP_TRACKED" | sort -u)
  for p in $packages; do
    subset=$(mktemp)
    grep -E "^packages/$p/" "$TMP_TRACKED" > "$subset"
    if [ -s "$subset" ]; then
      run_subset "packages/$p" "$subset"
    fi
    rm -f "$subset"
  done
else
  echo
  echo "No packages/ directory detected or no tracked files under packages/."
fi

exit 0
