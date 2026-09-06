#!/usr/bin/env bash
set -euo pipefail

# Sets all Cloudflare Worker secrets from .env.<env> files.
# Usage: ./scripts/set-secrets.sh <production|staging> [--dry-run]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV="${1:-}"
DRY_RUN=false

if [[ -z "$ENV" ]]; then
  echo "Usage: $0 <production|staging> [--dry-run]" >&2
  exit 1
fi

if [[ "$ENV" != "production" && "$ENV" != "staging" ]]; then
  echo "ERROR: environment must be 'production' or 'staging'" >&2
  exit 1
fi

if [[ "${2:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] No secrets will be written."
  echo
fi

put_secret() {
  local worker_dir="$1"
  local key="$2"
  local value="$3"

  if $DRY_RUN; then
    echo "  [dry-run] would set $key=$value"
  else
    echo "$value" | npx wrangler secret put "$key" --env "$ENV" --config "$worker_dir/wrangler.jsonc" 2>&1 | tail -1
  fi
}

set_secrets_from_env() {
  local worker_dir="$1"
  local env_file="$2"
  shift 2
  local keys=("$@")

  if [[ ! -f "$env_file" ]]; then
    echo "ERROR: $env_file not found" >&2
    exit 1
  fi

  for key in "${keys[@]}"; do
    value=$(grep "^${key}=" "$env_file" | head -1 | cut -d'=' -f2-)
    if [[ -z "$value" ]]; then
      echo "  WARN: $key not found in $env_file, skipping"
      continue
    fi
    put_secret "$worker_dir" "$key" "$value"
  done
}

WEB_SECRETS=(
  AUTH_SECRET
  EMAIL_FROM
  POSTMARK_SERVER_TOKEN
  SEND_EMAILS_IN_DEV
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  ORCID_CLIENT_ID
  ORCID_CLIENT_SECRET
  ADMIN_EMAIL
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET_AUTH
)

echo "=== web worker (packages/web) --env $ENV ==="
set_secrets_from_env "$ROOT/packages/web" "$ROOT/packages/web/.env.$ENV" "${WEB_SECRETS[@]}"

echo
echo "Done."
