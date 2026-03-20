#!/usr/bin/env bash
# PageSpeed Insights audit for CoRATES public pages
# Usage: ./scripts/pagespeed-audit.sh [API_KEY]
# Without an API key, uses the free tier (rate-limited)

set -euo pipefail

API_KEY="${1:-}"
BASE="https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

PAGES=(
  "https://corates.org/"
  "https://corates.org/about"
  "https://corates.org/pricing"
  "https://corates.org/resources"
)

STRATEGIES=("mobile" "desktop")

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

score_color() {
  local score=$1
  if (( score >= 90 )); then echo -e "${GREEN}${score}${NC}"
  elif (( score >= 50 )); then echo -e "${YELLOW}${score}${NC}"
  else echo -e "${RED}${score}${NC}"
  fi
}

echo -e "${BOLD}PageSpeed Insights Audit${NC}"
echo "========================================"
echo ""

for strategy in "${STRATEGIES[@]}"; do
  echo -e "${BOLD}${CYAN}Strategy: ${strategy^^}${NC}"
  echo "----------------------------------------"
  printf "%-30s %6s %6s %6s %6s %6s\n" "Page" "Perf" "A11y" "BP" "SEO" "FCP"
  printf "%-30s %6s %6s %6s %6s %6s\n" "----" "----" "----" "----" "----" "----"

  for url in "${PAGES[@]}"; do
    page_name="${url#https://corates.org}"
    [ -z "$page_name" ] && page_name="/"

    params="url=${url}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo"
    [ -n "$API_KEY" ] && params="${params}&key=${API_KEY}"

    result=$(curl -s "${BASE}?${params}" 2>/dev/null)

    # Check for errors
    error=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message',''))" 2>/dev/null || echo "parse_error")
    if [ -n "$error" ] && [ "$error" != "" ]; then
      printf "%-30s %s\n" "$page_name" "ERROR: $error"
      continue
    fi

    # Extract scores (0-1 float -> 0-100 int)
    read -r perf a11y bp seo fcp <<< $(echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cats = d.get('lighthouseResult', {}).get('categories', {})
audits = d.get('lighthouseResult', {}).get('audits', {})
perf = int(cats.get('performance', {}).get('score', 0) * 100)
a11y = int(cats.get('accessibility', {}).get('score', 0) * 100)
bp = int(cats.get('best-practices', {}).get('score', 0) * 100)
seo = int(cats.get('seo', {}).get('score', 0) * 100)
fcp = audits.get('first-contentful-paint', {}).get('displayValue', 'N/A')
print(f'{perf} {a11y} {bp} {seo} {fcp}')
" 2>/dev/null || echo "0 0 0 0 N/A")

    printf "%-30s " "$page_name"
    printf "%6b %6b %6b %6b %6s\n" \
      "$(score_color "$perf")" \
      "$(score_color "$a11y")" \
      "$(score_color "$bp")" \
      "$(score_color "$seo")" \
      "$fcp"

    # Rate limit courtesy (no key = stricter limits)
    [ -z "$API_KEY" ] && sleep 5
  done

  echo ""
done

echo "Legend: Perf=Performance, A11y=Accessibility, BP=Best Practices, SEO=SEO, FCP=First Contentful Paint"
echo "Scores: 90-100=green, 50-89=yellow, 0-49=red"
